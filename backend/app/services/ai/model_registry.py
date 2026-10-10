"""
Model registry — the ONE place in the whole codebase that decides which
concrete adapter implementation is active for the mudra model.

Every router / WebSocket handler imports `get_mudra_detector()`
from here instead of constructing an adapter itself.

WHICH ADAPTER IS ACTIVE:
    MUDRA_MODEL_MODE is "auto", "mock" or "real".
    "auto" follows DEMO_MODE (true -> mock, false -> real adapter); "mock"
    and "real" force one or the other for that model. Every prediction says
    which it was (source="real" | "mock").

IMPORTANT: when the mudra model resolves to "real" and no real adapter is
registered below, get_mudra_detector() returns an "unavailable" adapter whose
predict() raises ModelUnavailableError and whose get_status() reports
status="unavailable". The app NEVER silently falls back to mock predictions
for a model that is supposed to be real.
"""
from functools import lru_cache

from app.config import settings
from app.schemas.ai_status import AIStatusResponse, ModelInfo
from app.services.ai.base import (
     ModelUnavailableError,
     MudraModelAdapter,
)
from app.services.ai.mock_mudra_detector import MockMudraDetector
from app.services.ai.mudra_rf_adapter import KalaVisionMudraAdapter

# --- Real adapter ---
MUDRA_ADAPTER: MudraModelAdapter | None = KalaVisionMudraAdapter(
    model_dir=settings.mudra_model_dir, version=settings.mudra_model_version
)


def _use_mock(mode: str) -> bool:
    """Resolve mudra model mode ("auto" | "mock" | "real") to mock/real."""
    if mode == "mock":
        return True
    if mode == "real":
        return False
    return settings.demo_mode  # "auto" follows DEMO_MODE


class _UnavailableMudraAdapter(MudraModelAdapter):
    """Returned when the mudra model resolves to real mode but no real
    mudra adapter is registered."""

    async def predict(self, image_bytes: bytes, timestamp: float):
        raise ModelUnavailableError("mudra_model", "No real mudra model adapter is registered in model_registry.py")

    async def predict_batch(self, image_bytes_list: list[bytes], start_timestamp: float = 0.0):
        raise ModelUnavailableError("mudra_model", "No real mudra model adapter is registered in model_registry.py")

    async def get_status(self) -> ModelInfo:
        return ModelInfo(
            name="mudra_model", type="mudra", model_type="none", version="n/a",
            status="unavailable", supported_classes=0, integration="in_process",
            detail="This model is set to real mode but no real adapter is registered in model_registry.py.",
        )


@lru_cache
def get_mudra_detector() -> MudraModelAdapter:
    if _use_mock(settings.mudra_model_mode):
        return MockMudraDetector()
    if MUDRA_ADAPTER is not None:
        return MUDRA_ADAPTER
    return _UnavailableMudraAdapter()


async def warm_up_models() -> None:
    """Loads the real mudra model once at startup."""
    detector = get_mudra_detector()
    warm_up = getattr(detector, "warm_up", None)
    if warm_up is not None:
        try:
            await warm_up()
        except Exception:
            pass


async def get_ai_status() -> AIStatusResponse:
    """Powers GET /api/ai/status — reports whether mudra model is connected."""
    mudra_status = await get_mudra_detector().get_status()
    return AIStatusResponse(
        demo_mode=settings.demo_mode,
        mudra_model=mudra_status,
    )
