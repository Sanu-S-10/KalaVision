"""
This file defines the ONE contract every AI model — mock or real, whatever
framework it's built in (TensorFlow, PyTorch, YOLO, MediaPipe, CNN, LSTM...) —
must produce. The frontend and the rest of the backend only ever see this
shape, so swapping a mock detector for a teammate's real model later means
writing a new adapter that returns `MudraPrediction` / `ExpressionPrediction`,
not touching any downstream code.

`source` and `model_version` make it possible to tell, anywhere downstream
(API response, stored detection, analytics, UI), whether a given result came
from a real model, the demo mock, or a human correction made during Detection
Review. `is_uncertain` is derived from the configured confidence threshold
(see config.CONFIDENCE_THRESHOLD / utils.confidence) — the frontend uses it
to show "Uncertain prediction" instead of presenting a low-confidence guess
as settled fact.
"""
from typing import Literal

from pydantic import BaseModel, Field

PredictionSource = Literal["real", "mock", "user_corrected"]


class BoundingBox(BaseModel):
    x: float
    y: float
    width: float
    height: float


class MudraPrediction(BaseModel):
    name: str
    confidence: float = Field(ge=0.0, le=1.0)
    timestamp: float  # seconds into the performance/video
    bounding_box: BoundingBox | None = None
    source: PredictionSource = "mock"
    model_version: str = "mock-1.0"
    is_uncertain: bool = False


class ExpressionPrediction(BaseModel):
    name: str
    confidence: float = Field(ge=0.0, le=1.0)
    timestamp: float
    rasa: str | None = None  # navarasa category, if applicable
    source: PredictionSource = "mock"
    model_version: str = "mock-1.0"
    is_uncertain: bool = False


class CombinedPrediction(BaseModel):
    mudra: MudraPrediction
    expression: ExpressionPrediction
    interpretation: str | None = None


class PredictionRequest(BaseModel):
    """For frame-by-frame prediction requests carrying a base64 image."""
    image_base64: str
    performance_id: str | None = None
    timestamp: float | None = None


class VideoAnalysisRequest(BaseModel):
    performance_id: str
    video_url: str
    # How many frames per second of video to actually run detection on.
    # Keeping this low (the default) avoids redundant work on near-identical
    # consecutive frames from a high-FPS source; raise it for fast gesture
    # changes, lower it for long, slow performances.
    sample_fps: float = 2.0
