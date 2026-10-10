from datetime import datetime, timezone
import tempfile
import uuid

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status

from app.schemas.performance import DetectionEvent, OriginalPrediction, PerformanceCreate, PerformanceResponse
from app.services.ai.base import ModelUnavailableError
from app.services.ai.model_registry import get_expression_detector, get_mudra_detector
from app.services.knowledge_repository import get_knowledge_repository
from app.services.session_store import session_store
from app.services.story_engine import get_story_engine
from app.services.video_pipeline import (
    apply_temporal_smoothing,
    build_story_for_sequence,
    extract_sampled_frames_from_path,
    run_detection_on_frames,
    validate_video_bytes,
)
from app.utils.exceptions import bad_request, not_found
from app.utils.file_validation import validate_file_size, validate_video_file

router = APIRouter(prefix="/api/performances", tags=["performances"])


def _to_response(session: dict) -> PerformanceResponse:
    duration = None
    if session.get("started_at") and session.get("ended_at"):
        duration = (session["ended_at"] - session["started_at"]).total_seconds()

    return PerformanceResponse(
        id=session["id"],
        user_id="local_user",
        title=session["title"],
        mode=session["mode"],
        story_title=session.get("story_title"),
        video_url=session.get("video_url"),
        character=session.get("character"),
        scene=session.get("scene"),
        status=session["status"],
        started_at=session["started_at"],
        ended_at=session.get("ended_at"),
        detection_count=len(session.get("detections", [])),
        duration_seconds=duration,
    )


def _dict_to_detection_event(doc: dict) -> DetectionEvent:
    original = None
    if doc.get("original_prediction"):
        original = OriginalPrediction(**doc["original_prediction"])
    return DetectionEvent(
        id=doc.get("id", str(uuid.uuid4())),
        performance_id=doc["performance_id"],
        mudra_name=doc["mudra_name"],
        mudra_confidence=doc["mudra_confidence"],
        expression_name=doc["expression_name"],
        expression_confidence=doc["expression_confidence"],
        interpretation=doc.get("interpretation"),
        timestamp=doc["timestamp"],
        created_at=doc.get("created_at"),
        source=doc.get("source", "real"),
        model_version=doc.get("model_version", "1.0"),
        expression_source=doc.get("expression_source", doc.get("source", "real")),
        expression_model_version=doc.get("expression_model_version", doc.get("model_version", "1.0")),
        mudra_is_uncertain=doc.get("mudra_is_uncertain", False),
        expression_is_uncertain=doc.get("expression_is_uncertain", False),
        is_corrected=doc.get("is_corrected", False),
        original_prediction=original,
        reviewed_by=doc.get("reviewed_by"),
        reviewed_at=doc.get("reviewed_at"),
        is_deleted=doc.get("is_deleted", False),
        deleted_at=doc.get("deleted_at"),
    )


@router.post("", response_model=PerformanceResponse, status_code=201)
async def create_performance(payload: PerformanceCreate):
    session = session_store.create_session(
        title=payload.title,
        mode=payload.mode,
        character=payload.character,
        scene=payload.scene,
        story_title=payload.story_title,
    )
    return _to_response(session)


@router.get("", response_model=list[PerformanceResponse])
async def list_performances(
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
):
    sessions = session_store.list_sessions()[offset : offset + limit]
    return [_to_response(s) for s in sessions]


@router.get("/{performance_id}", response_model=PerformanceResponse)
async def get_performance(performance_id: str):
    session = session_store.get_session(performance_id)
    if not session:
        raise not_found("Performance")
    return _to_response(session)


@router.post("/{performance_id}/end", response_model=PerformanceResponse)
async def end_performance(performance_id: str):
    session = session_store.end_session(performance_id)
    if not session:
        raise not_found("Performance")
    return _to_response(session)


@router.get("/{performance_id}/detections", response_model=list[DetectionEvent])
async def list_detections(performance_id: str):
    session = session_store.get_session(performance_id)
    if not session:
        raise not_found("Performance")
    return [_dict_to_detection_event(d) for d in session.get("detections", [])]


@router.post("/{performance_id}/analyze-video", response_model=list[DetectionEvent])
async def analyze_video(
    performance_id: str,
    file: UploadFile = File(...),
    sample_fps: float = Query(default=2.0, gt=0, le=30),
):
    """Video Analysis pipeline: extracts frames -> detects real mudras ->
    smooths -> builds story events -> saves into transient session for direct
    report export. Zero database persistence required."""
    session = session_store.get_session(performance_id)
    if not session:
        session = session_store.create_session(
            title=file.filename or "Video Analysis",
            mode="video",
            session_id=performance_id,
        )

    validate_video_file(file)
    raw = await file.read()
    validate_file_size(len(raw))
    validate_video_bytes(raw)

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=True) as tmp:
        tmp.write(raw)
        tmp.flush()
        frames = extract_sampled_frames_from_path(tmp.name, sample_fps)

    if not frames:
        raise bad_request("No frames could be extracted from this video.")

    mudra_detector = get_mudra_detector()
    expression_detector = get_expression_detector()
    story_engine = get_story_engine()
    knowledge = get_knowledge_repository()

    try:
        predictions = await run_detection_on_frames(frames, mudra_detector, expression_detector)
    except ModelUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": "model_unavailable", "model": exc.model_name, "message": exc.detail},
        ) from exc

    predictions = apply_temporal_smoothing(predictions)
    await build_story_for_sequence(
        predictions,
        story_engine,
        knowledge,
        character=session.get("character"),
        scene=session.get("scene"),
    )

    now = datetime.now(timezone.utc)
    detection_events = []
    for p in predictions:
        event_dict = {
            "id": str(uuid.uuid4()),
            "performance_id": performance_id,
            "mudra_name": p.mudra.name,
            "mudra_confidence": p.mudra.confidence,
            "expression_name": p.expression.name,
            "expression_confidence": p.expression.confidence,
            "interpretation": p.interpretation,
            "timestamp": p.mudra.timestamp,
            "created_at": now,
            "source": p.mudra.source,
            "model_version": p.mudra.model_version,
            "expression_source": p.expression.source,
            "expression_model_version": p.expression.model_version,
            "mudra_is_uncertain": p.mudra.is_uncertain,
            "expression_is_uncertain": p.expression.is_uncertain,
            "is_corrected": False,
            "original_prediction": None,
            "is_deleted": False,
            "deleted_at": None,
        }
        session_store.add_detection(performance_id, event_dict)
        if p.interpretation:
            session_store.add_story_event(
                performance_id,
                {"text": p.interpretation, "timestamp": p.mudra.timestamp},
            )
        detection_events.append(_dict_to_detection_event(event_dict))

    session_store.end_session(performance_id)
    return detection_events
