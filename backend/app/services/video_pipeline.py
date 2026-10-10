"""
Video Analysis pipeline.

Processing flow:
    validate video
        -> extract frames
        -> sample frames (configurable FPS)
        -> run real mudra detection (+ expression detection if available)
        -> assign timestamps
        -> confidence filtering (mark low-confidence results uncertain)
        -> temporal smoothing (stabilize flicker across sampled frames)
        -> sequence / context analysis (SequenceContextEngine)
        -> story interpretation (StoryEngine)
        -> return scene-by-scene detections and story interpretation
"""
import cv2

from app.schemas.prediction import CombinedPrediction, ExpressionPrediction
from app.services.ai.base import (
    ExpressionModelAdapter,
    ModelUnavailableError,
    MudraModelAdapter,
    NoDetectionError,
)
from app.services.context_engine import DetectionPoint, SequenceContextEngine
from app.services.knowledge_repository import KnowledgeRepository
from app.services.smoothing import PredictionSmoother
from app.services.story_engine import StoryEngine
from app.utils.confidence import is_uncertain
from app.utils.exceptions import bad_request


def validate_video_bytes(video_bytes: bytes) -> None:
    if len(video_bytes) == 0:
        raise bad_request("Uploaded video is empty.")


def sample_frame_indices(total_frames: int, fps: float, sample_fps: float) -> list[int]:
    """Which frame indices to actually run detection on, given the video's
    native fps and the desired sampling rate. Returns evenly-spaced
    indices rather than every frame."""
    if fps <= 0 or sample_fps <= 0:
        return list(range(total_frames))
    step = max(1, round(fps / sample_fps))
    return list(range(0, total_frames, step))


def extract_sampled_frames_from_path(path: str, sample_fps: float) -> list[tuple[bytes, float]]:
    """Frame extraction + frame sampling stages: decodes the video from an
    on-disk file and returns (jpeg_bytes, timestamp_seconds) pairs for only
    the sampled frame indices."""
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise bad_request("Could not open the uploaded video — the file may be corrupt or an unsupported codec.")

    fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    indices = set(sample_frame_indices(total_frames, fps, sample_fps))

    results: list[tuple[bytes, float]] = []
    frame_idx = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if frame_idx in indices:
            timestamp = frame_idx / fps if fps > 0 else float(frame_idx)
            ok2, buf = cv2.imencode(".jpg", frame)
            if ok2:
                results.append((buf.tobytes(), timestamp))
        frame_idx += 1

    cap.release()
    return results


async def run_detection_on_frames(
    frames: list[tuple[bytes, float]],
    mudra_detector: MudraModelAdapter,
    expression_detector: ExpressionModelAdapter,
) -> list[CombinedPrediction]:
    """Detection stage: runs mudra detector on each sampled frame (frames with
    no detection are skipped). If mudra model is unavailable, raises
    ModelUnavailableError. If expression model is unavailable, reports expression
    as unavailable rather than failing the entire mudra recognition pipeline."""
    results: list[CombinedPrediction] = []
    for frame_bytes, timestamp in frames:
        try:
            mudra = await mudra_detector.predict(frame_bytes, timestamp)
        except NoDetectionError:
            continue

        try:
            expression = await expression_detector.predict(frame_bytes, timestamp)
        except (ModelUnavailableError, NoDetectionError):
            expression = ExpressionPrediction(
                name="Unavailable",
                confidence=0.0,
                timestamp=timestamp,
                rasa=None,
                source="real",
                model_version="n/a",
                is_uncertain=True,
            )

        results.append(CombinedPrediction(mudra=mudra, expression=expression))
    return results


def apply_temporal_smoothing(predictions: list[CombinedPrediction], window_size: int | None = None) -> list[CombinedPrediction]:
    """Smoothing stage: run PredictionSmoother across the sampled-frame sequence."""
    mudra_smoother = PredictionSmoother(window_size)
    expression_smoother = PredictionSmoother(window_size)
    smoothed: list[CombinedPrediction] = []

    for pred in predictions:
        sm = mudra_smoother.push(pred.mudra.name, pred.mudra.confidence, pred.mudra.timestamp)
        pred.mudra.name, pred.mudra.confidence = sm.name, sm.confidence
        pred.mudra.is_uncertain = is_uncertain(pred.mudra.confidence)

        if pred.expression.name != "Unavailable":
            se = expression_smoother.push(pred.expression.name, pred.expression.confidence, pred.expression.timestamp)
            pred.expression.name, pred.expression.confidence = se.name, se.confidence
            pred.expression.is_uncertain = is_uncertain(pred.expression.confidence)

        smoothed.append(pred)

    return smoothed


async def build_story_for_sequence(
    predictions: list[CombinedPrediction],
    story_engine: StoryEngine,
    knowledge: KnowledgeRepository | None = None,
    character: str | None = None,
    scene: str | None = None,
) -> list[str]:
    """Sequence/context analysis + story interpretation stages, applied
    across the whole smoothed sequence in order."""
    context_engine = SequenceContextEngine()
    history: list[DetectionPoint] = []
    interpretations: list[str] = []

    for pred in predictions:
        expr_name = pred.expression.name if pred.expression.name != "Unavailable" else "classical"
        history.append(DetectionPoint(pred.mudra.name, expr_name, pred.mudra.timestamp))
        context = context_engine.build_context(history, character=character, scene=scene)
        line = await story_engine.generate_event(
            pred.mudra.name, expr_name, pred.mudra.timestamp, interpretations, context, knowledge
        )
        interpretations.append(line)
        pred.interpretation = line

    return interpretations
