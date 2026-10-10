"""
WebSocket endpoint for real-time Live Performance detection:

    Camera (frontend) -> frame capture/sampling
        -> base64-encoded frame + timestamp over this WebSocket
        -> KalaVision Mudra Classifier (Random Forest + MediaPipe)
        -> Hand Landmark Extraction (21 3D points)
        -> Confidence Filtering (is_uncertain)
        -> Temporal Smoothing (PredictionSmoother)
        -> Sequence Context Engine & Story Engine
        -> WebSocket response -> UI with Hand Skeleton Overlay + Predictions
"""
import base64
from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.services.ai.base import ModelUnavailableError, NoDetectionError
from app.services.ai.model_registry import get_mudra_detector
from app.services.context_engine import DetectionPoint, SequenceContextEngine
from app.services.demo_mode import simulate_performance
from app.services.knowledge_repository import get_knowledge_repository
from app.services.session_store import session_store
from app.services.smoothing import PredictionSmoother
from app.services.story_engine import get_story_engine
from app.utils.confidence import is_uncertain

router = APIRouter()


@router.websocket("/api/ws/live")
async def live_detection_socket(
    websocket: WebSocket,
    demo: bool = Query(default=False),
    performance_id: str | None = Query(default=None),
):
    await websocket.accept()

    try:
        if demo:
            async for event in simulate_performance():
                await websocket.send_json(event)
        else:
            mudra_detector = get_mudra_detector()
            story_engine = get_story_engine()
            context_engine = SequenceContextEngine()
            knowledge = get_knowledge_repository()

            session_id = performance_id or str(uuid.uuid4())
            existing = session_store.get_session(session_id)
            if not existing:
                session_store.create_session(
                    title=f"Live Session {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}",
                    mode="live",
                    session_id=session_id,
                )

            mudra_smoother = PredictionSmoother()
            events_so_far: list[str] = []
            history: list[DetectionPoint] = []

            while True:
                payload = await websocket.receive_json()

                try:
                    img_data = payload["image_base64"]
                    if "," in img_data[:40]:
                        img_data = img_data.split(",", 1)[1]
                    image_bytes = base64.b64decode(img_data)
                except (KeyError, ValueError, TypeError):
                    await websocket.send_json(
                        {"type": "error", "error": "bad_frame", "message": "Could not decode the frame."}
                    )
                    continue

                timestamp = payload.get("timestamp", 0.0)

                try:
                    mudra = await mudra_detector.predict(image_bytes, timestamp)
                except ModelUnavailableError as exc:
                    await websocket.send_json(
                        {
                            "type": "error",
                            "error": "model_unavailable",
                            "model": exc.model_name,
                            "message": exc.detail,
                        }
                    )
                    continue
                except NoDetectionError as exc:
                    await websocket.send_json(
                        {
                            "type": "no_detection",
                            "model": exc.model_name,
                            "message": exc.detail or "Hand not detected — position your hand inside the frame.",
                            "timestamp": timestamp,
                            "hand_detected": False,
                            "landmarks": [],
                        }
                    )
                    continue

                # Temporal smoothing for mudra prediction
                smoothed_mudra = mudra_smoother.push(mudra.name, mudra.confidence, timestamp)
                mudra.name = smoothed_mudra.name
                mudra.confidence = smoothed_mudra.confidence
                mudra.is_uncertain = is_uncertain(mudra.confidence)

                history.append(DetectionPoint(mudra_name=mudra.name, timestamp=timestamp))
                context = context_engine.build_context(history)

                interpretation = await story_engine.generate_event(
                    mudra.name, timestamp, events_so_far, context, knowledge
                )
                events_so_far.append(interpretation)

                # Save to in-memory session store
                detection_record = {
                    "performance_id": session_id,
                    "mudra_name": mudra.name,
                    "mudra_confidence": mudra.confidence,
                    "interpretation": interpretation,
                    "timestamp": timestamp,
                    "created_at": datetime.now(timezone.utc),
                    "source": mudra.source,
                    "model_version": mudra.model_version,
                    "mudra_is_uncertain": mudra.is_uncertain,
                    "hand_detected": mudra.hand_detected,
                    "landmarks": [lm.model_dump() for lm in mudra.landmarks] if mudra.landmarks else [],
                    "is_corrected": False,
                    "original_prediction": None,
                    "is_deleted": False,
                    "deleted_at": None,
                }
                session_store.add_detection(session_id, detection_record)
                session_store.add_story_event(session_id, {"text": interpretation, "timestamp": timestamp})

                await websocket.send_json(
                    {
                        "type": "detection",
                        "data": {
                            "mudra": mudra.model_dump(),
                            "hand_detected": mudra.hand_detected,
                            "landmarks": [lm.model_dump() for lm in mudra.landmarks] if mudra.landmarks else [],
                            "all_hands": [[lm.model_dump() for lm in hand] for hand in mudra.all_hands] if mudra.all_hands else [],
                            "interpretation": interpretation,
                            "timestamp": timestamp,
                        },
                        "story_so_far": await story_engine.summarize(events_so_far),
                        "is_stable": smoothed_mudra.is_stable,
                        "session_id": session_id,
                    }
                )
    except WebSocketDisconnect:
        if not demo and session_id:
            session_store.end_session(session_id)
        return
