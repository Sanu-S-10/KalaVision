"""
AI Integration Layer — adapter interfaces.

Everything downstream (routers, WebSocket handler, story/context engine)
talks to these interfaces ONLY. It never knows or cares whether the
concrete implementation behind them is a mock, a TensorFlow SavedModel, a
PyTorch checkpoint, a YOLO weights file, a MediaPipe + CNN pipeline, or an
HTTP call to a model running as its own service.

TWO WAYS TO PLUG IN A REAL MUDRA MODEL:

  (1) IN-PROCESS PYTHON MODEL
      Your model loads and runs inside this FastAPI process.
      -> Subclass `MudraModelAdapter` directly, load your model/weights
         in `__init__`, and run inference in `predict()`.
         See mock_mudra_detector.py for the shape to follow.

  (2) SEPARATE HTTP/API SERVICE
      Your model runs as its own server and you call it over HTTP.
      -> Subclass `HTTPMudraModelAdapter` below.

Either way, THE ONLY THING THAT CHANGES is a new file in this folder and
one line in `model_registry.py`. Routers, the WebSocket handler, and the
entire frontend are unaffected.

This is the entire contract a teammate's model needs to satisfy:
  input  -> a single image frame (as raw bytes) + timestamp
  output -> MudraPrediction (see schemas/prediction.py),
            with `source="real"` and a meaningful `model_version`
  status -> a ModelInfo describing the model (see schemas/ai_status.py),
            used by GET /api/ai/status
"""
from abc import ABC, abstractmethod

import httpx

from app.schemas.ai_status import ModelInfo
from app.schemas.prediction import MudraPrediction


class ModelUnavailableError(Exception):
    """Raised by a real adapter when the underlying model/service can't
    serve a prediction right now (not loaded, HTTP call failed, etc).
    Routers catch this and return a clear "model unavailable" error to the
    client instead of ever silently substituting a mock prediction."""

    def __init__(self, model_name: str, detail: str):
        self.model_name = model_name
        self.detail = detail
        super().__init__(f"{model_name} unavailable: {detail}")


class NoDetectionError(Exception):
    """Raised by a real adapter when the model ran fine but found nothing
    to classify in this frame (e.g. no hand in view, or the frame couldn't
    be decoded). This is a NORMAL outcome for a live camera — it is not a
    model failure — so callers handle it by skipping the frame: the
    WebSocket sends a `no_detection` message, the video pipeline drops the
    frame, and REST endpoints return 422. Mock adapters never raise it."""

    def __init__(self, model_name: str, detail: str):
        self.model_name = model_name
        self.detail = detail
        super().__init__(f"{model_name}: {detail}")


class MudraModelAdapter(ABC):
    @abstractmethod
    async def predict(self, image_bytes: bytes, timestamp: float) -> MudraPrediction:
        """Given one frame, return the top predicted mudra. Raise
        ModelUnavailableError if the model can't be reached/run, or
        NoDetectionError if it ran but found no hand in the frame."""
        raise NotImplementedError

    @abstractmethod
    async def predict_batch(self, image_bytes_list: list[bytes], start_timestamp: float = 0.0) -> list[MudraPrediction]:
        """Given a sequence of frames (e.g. sampled from an uploaded video), return one prediction per frame."""
        raise NotImplementedError

    @abstractmethod
    async def get_status(self) -> ModelInfo:
        """Report whether this model is reachable, plus metadata for the
        AI Model Status screen (GET /api/ai/status)."""
        raise NotImplementedError


# Back-compat alias
MudraDetector = MudraModelAdapter


class HTTPMudraModelAdapter(MudraModelAdapter):
    """Base class for a mudra model running as a separate HTTP service.
    Subclass and set `base_url`, or just instantiate directly with one.
    Expects the service to expose POST {base_url}/predict accepting
    multipart/form-data (file=<image>, timestamp=<float>) and returning
    JSON shaped like MudraPrediction minus `source`/`model_version`
    (this adapter fills those in). Override `_parse_response()` if your
    service's JSON differs."""

    model_name = "mudra_model"
    model_version = "unknown"

    def __init__(self, base_url: str, timeout_seconds: float = 10.0):
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    async def predict(self, image_bytes: bytes, timestamp: float) -> MudraPrediction:
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                resp = await client.post(
                    f"{self.base_url}/predict",
                    files={"file": ("frame.jpg", image_bytes, "image/jpeg")},
                    data={"timestamp": timestamp},
                )
                resp.raise_for_status()
                return self._parse_response(resp.json(), timestamp)
        except httpx.HTTPError as exc:
            raise ModelUnavailableError(self.model_name, str(exc)) from exc

    async def predict_batch(self, image_bytes_list: list[bytes], start_timestamp: float = 0.0) -> list[MudraPrediction]:
        results = []
        for i, frame in enumerate(image_bytes_list):
            results.append(await self.predict(frame, start_timestamp + i))
        return results

    def _parse_response(self, data: dict, timestamp: float) -> MudraPrediction:
        return MudraPrediction(
            name=data["name"],
            confidence=data["confidence"],
            timestamp=timestamp,
            source="real",
            model_version=self.model_version,
        )

    async def get_status(self) -> ModelInfo:
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                resp = await client.get(f"{self.base_url}/health")
                resp.raise_for_status()
                meta = resp.json()
        except httpx.HTTPError as exc:
            return ModelInfo(
                name=self.model_name, type="mudra", model_type="http_service",
                version=self.model_version, status="unavailable",
                supported_classes=0, integration="http_api", detail=str(exc),
            )
        return ModelInfo(
            name=meta.get("name", self.model_name), type="mudra",
            model_type=meta.get("model_type", "http_service"),
            version=meta.get("version", self.model_version), status="connected",
            supported_classes=meta.get("supported_classes", 0),
            accuracy=meta.get("accuracy"), integration="http_api",
        )
