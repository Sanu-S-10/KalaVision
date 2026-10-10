"""
AI Model Status + connectivity test endpoints.

GET /api/ai/status reports whether each model is connected, unavailable,
or running in demo mode (used by the dashboard/settings UI).

POST /api/ai/test/mudra and /api/ai/test/expression verify model connectivity
without requiring a full performance session.
"""
import numpy as np
from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.schemas.ai_status import AIStatusResponse
from app.schemas.prediction import ExpressionPrediction, MudraPrediction
from app.services.ai.base import ModelUnavailableError, NoDetectionError
from app.services.ai.model_registry import get_ai_status, get_expression_detector, get_mudra_detector

router = APIRouter(prefix="/api/ai", tags=["ai-status"])


def _placeholder_frame() -> bytes:
    """A tiny synthetic JPEG, used only when a test call doesn't supply
    its own image — enough for a real adapter to prove it can decode a
    frame and return a prediction."""
    import cv2

    blank = np.zeros((32, 32, 3), dtype=np.uint8)
    ok, buf = cv2.imencode(".jpg", blank)
    return buf.tobytes() if ok else b""


def _no_detection_response(exc: NoDetectionError, used_placeholder: bool) -> HTTPException:
    message = exc.detail
    if used_placeholder:
        message += (
            " No image was uploaded, so a blank placeholder frame was used — "
            "the model itself loaded and ran. Upload a photo to test real inference."
        )
    return HTTPException(
        status_code=422,
        detail={"error": "no_detection", "model": exc.model_name, "message": message},
    )


@router.get("/status", response_model=AIStatusResponse)
async def ai_status():
    """Reports whether the mudra and expression models are connected,
    unavailable, or running in demo mode, plus metadata."""
    return await get_ai_status()


@router.post("/test/mudra", response_model=MudraPrediction)
async def test_mudra_model(file: UploadFile | None = File(default=None)):
    """Quick connectivity check for whichever mudra adapter is currently registered."""
    image_bytes = await file.read() if file is not None else _placeholder_frame()
    detector = get_mudra_detector()
    try:
        return await detector.predict(image_bytes, 0.0)
    except ModelUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": "model_unavailable", "model": exc.model_name, "message": exc.detail},
        ) from exc
    except NoDetectionError as exc:
        raise _no_detection_response(exc, used_placeholder=file is None) from exc


@router.post("/test/expression", response_model=ExpressionPrediction)
async def test_expression_model(file: UploadFile | None = File(default=None)):
    """Quick connectivity check for whichever expression adapter is currently registered."""
    image_bytes = await file.read() if file is not None else _placeholder_frame()
    detector = get_expression_detector()
    try:
        return await detector.predict(image_bytes, 0.0)
    except ModelUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": "model_unavailable", "model": exc.model_name, "message": exc.detail},
        ) from exc
    except NoDetectionError as exc:
        raise _no_detection_response(exc, used_placeholder=file is None) from exc
