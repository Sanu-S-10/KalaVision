import base64

from fastapi import APIRouter, HTTPException, status

from app.schemas.prediction import MudraPrediction, PredictionRequest
from app.services.ai.base import ModelUnavailableError, NoDetectionError
from app.services.ai.model_registry import get_mudra_detector
from app.services.context_engine import DetectionPoint, SequenceContextEngine
from app.services.knowledge_repository import get_knowledge_repository
from app.services.story_engine import get_story_engine

router = APIRouter(prefix="/api/predict", tags=["predictions"])
_context_engine = SequenceContextEngine()


def _decode_image(image_base64: str) -> bytes:
    # Accepts both raw base64 and data: URLs ("data:image/jpeg;base64,...")
    if "," in image_base64[:40]:
        image_base64 = image_base64.split(",", 1)[1]
    return base64.b64decode(image_base64)


def _model_unavailable_response(exc: ModelUnavailableError) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={"error": "model_unavailable", "model": exc.model_name, "message": exc.detail},
    )


def _no_detection_response(exc: NoDetectionError) -> HTTPException:
    return HTTPException(
        status_code=422,
        detail={"error": "no_detection", "model": exc.model_name, "message": exc.detail},
    )


@router.post("/mudra", response_model=MudraPrediction)
async def predict_mudra(payload: PredictionRequest):
    detector = get_mudra_detector()
    story_engine = get_story_engine()
    knowledge = get_knowledge_repository()

    image_bytes = _decode_image(payload.image_base64)
    timestamp = payload.timestamp or 0.0
    try:
        mudra = await detector.predict(image_bytes, timestamp)
        context = _context_engine.build_context([DetectionPoint(mudra.name, timestamp)])
        mudra.interpretation = await story_engine.generate_event(
            mudra.name, timestamp, [], context, knowledge
        )
        return mudra
    except ModelUnavailableError as exc:
        raise _model_unavailable_response(exc) from exc
    except NoDetectionError as exc:
        raise _no_detection_response(exc) from exc
