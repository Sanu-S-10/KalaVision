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

from app.schemas.prediction import MudraPrediction
from app.services.ai.base import (
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
) -> list[MudraPrediction]:
    """Detection stage: runs mudra detector on each sampled frame (frames with
    no detection are skipped)."""
    results: list[MudraPrediction] = []
    for frame_bytes, timestamp in frames:
        try:
            mudra = await mudra_detector.predict(frame_bytes, timestamp)
            results.append(mudra)
        except NoDetectionError:
            continue
    return results


def apply_temporal_smoothing(predictions: list[MudraPrediction], window_size: int | None = None) -> list[MudraPrediction]:
    """Smoothing stage: run PredictionSmoother across the sampled-frame sequence."""
    mudra_smoother = PredictionSmoother(window_size)
    smoothed: list[MudraPrediction] = []

    for pred in predictions:
        sm = mudra_smoother.push(pred.name, pred.confidence, pred.timestamp)
        pred.name, pred.confidence = sm.name, sm.confidence
        pred.is_uncertain = is_uncertain(pred.confidence)
        smoothed.append(pred)

    return smoothed


async def build_story_for_sequence(
    predictions: list[MudraPrediction],
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
        history.append(DetectionPoint(pred.name, pred.timestamp))
        context = context_engine.build_context(history, character=character, scene=scene)
        line = await story_engine.generate_event(
            pred.name, pred.timestamp, interpretations, context, knowledge
        )
        interpretations.append(line)
        pred.interpretation = line

    return interpretations
