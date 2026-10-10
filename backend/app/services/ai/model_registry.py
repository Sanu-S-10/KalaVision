"""
Model registry — the ONE place in the whole codebase that decides which
concrete adapter implementation is active for each model.

Every router / WebSocket handler imports `get_mudra_detector()` and
`get_expression_detector()` from here instead of constructing an adapter
itself. That means swapping mocks for real models is a one-file change:

    HOW TO PLUG IN A REAL MODEL
    ----------------------------------------------------------------
    IN-PROCESS MODEL (loads and runs inside this backend):
      1. Implement a class in services/ai/ subclassing MudraModelAdapter
         or ExpressionModelAdapter (base.py), e.g. mudra_detector.py.
      2. Import it below and set MUDRA_ADAPTER / EXPRESSION_ADAPTER to an
         instance of it.

    SEPARATE HTTP MODEL SERVICE (your model runs as its own server):
      1. Subclass HTTPMudraModelAdapter / HTTPExpressionModelAdapter
         (base.py) if you need custom response parsing, or use them
         directly if your service already matches the expected contract.
      2. Set MUDRA_ADAPTER / EXPRESSION_ADAPTER to an instance pointed at
         settings.mudra_model_api_url / settings.expression_model_api_url.

    Then set the model's mode in .env (see below). Nothing else in the app
    changes — routers, the WebSocket handler, and the entire frontend only
    ever see the standardized MudraPrediction / ExpressionPrediction shapes.

WHICH ADAPTER IS ACTIVE (per model):
    MUDRA_MODEL_MODE / EXPRESSION_MODEL_MODE are "auto", "mock" or "real".
    "auto" follows DEMO_MODE (true -> mock, false -> real adapter); "mock"
    and "real" force one or the other for that model alone, which is how
    the mudra model can run for real while the expression model is still
    a mock. It is always an explicit setting, and every prediction says
    which it was (source="real" | "mock").

IMPORTANT: when a model resolves to "real" and no real adapter is
registered below, get_mudra_detector()/get_expression_detector() return an
"unavailable" adapter whose predict() raises ModelUnavailableError and
whose get_status() reports status="unavailable". The app NEVER silently
falls back to mock predictions for a model that is supposed to be real —
callers (routers, websocket) must catch ModelUnavailableError and surface
a clear error to the user instead.
"""
from functools import lru_cache

from app.config import settings
from app.schemas.ai_status import AIStatusResponse, ModelInfo
from app.services.ai.base import (
    ExpressionModelAdapter,
    ModelUnavailableError,
    MudraModelAdapter,
)
from app.services.ai.mock_expression_detector import MockExpressionDetector
from app.services.ai.mock_mudra_detector import MockMudraDetector
from app.services.ai.mudra_rf_adapter import KalaVisionMudraAdapter

# --- Real adapters ---
# Construction is cheap and never loads a model (loading is lazy, and
# warm_up_models() below does it at startup), so registering this is safe
# even when the model files are missing: the model then reports
# status="unavailable" with the reason instead of breaking the app.
MUDRA_ADAPTER: MudraModelAdapter | None = KalaVisionMudraAdapter(
    model_dir=settings.mudra_model_dir, version=settings.mudra_model_version
)

# No real expression model yet. When it arrives, register it here, e.g.:
# from app.services.ai.base import HTTPExpressionModelAdapter
# EXPRESSION_ADAPTER: ExpressionModelAdapter | None = HTTPExpressionModelAdapter(
#     base_url=settings.expression_model_api_url, timeout_seconds=settings.model_api_timeout_seconds
# )
EXPRESSION_ADAPTER: ExpressionModelAdapter | None = None


def _use_mock(mode: str) -> bool:
    """Resolve one model's mode ("auto" | "mock" | "real") to mock/real."""
    if mode == "mock":
        return True
    if mode == "real":
        return False
    return settings.demo_mode  # "auto" follows DEMO_MODE


class _UnavailableMudraAdapter(MudraModelAdapter):
    """Returned when the mudra model resolves to real mode but no real
    mudra adapter is registered. Every call raises ModelUnavailableError — this is the
    mechanism that keeps the app from ever silently mocking a result once
    demo mode is turned off."""

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


class _UnavailableExpressionAdapter(ExpressionModelAdapter):
    async def predict(self, image_bytes: bytes, timestamp: float):
        raise ModelUnavailableError("expression_model", "No real expression model adapter is registered in model_registry.py")

    async def predict_batch(self, image_bytes_list: list[bytes], start_timestamp: float = 0.0):
        raise ModelUnavailableError("expression_model", "No real expression model adapter is registered in model_registry.py")

    async def get_status(self) -> ModelInfo:
        return ModelInfo(
            name="expression_model", type="expression", model_type="none", version="n/a",
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


@lru_cache
def get_expression_detector() -> ExpressionModelAdapter:
    if _use_mock(settings.expression_model_mode):
        return MockExpressionDetector()
    if EXPRESSION_ADAPTER is not None:
        return EXPRESSION_ADAPTER
    return _UnavailableExpressionAdapter()


async def warm_up_models() -> None:
    """Called once at startup: loads any real model that is going to be
    used, so the first live frame doesn't wait ~10s for it to load. A
    model that fails to load is recorded as unavailable (visible in
    /api/ai/status), never allowed to stop the API from starting."""
    for detector in (get_mudra_detector(), get_expression_detector()):
        warm_up = getattr(detector, "warm_up", None)
        if warm_up is not None:
            try:
                await warm_up()
            except Exception:
                pass


async def get_ai_status() -> AIStatusResponse:
    """Powers GET /api/ai/status — reports whether each model is
    connected, unavailable, or running in demo mode, plus metadata for the
    AI Model Status section in the dashboard/settings UI."""
    mudra_status = await get_mudra_detector().get_status()
    expression_status = await get_expression_detector().get_status()
    return AIStatusResponse(
        demo_mode=settings.demo_mode,
        mudra_model=mudra_status,
        expression_model=expression_status,
    )
