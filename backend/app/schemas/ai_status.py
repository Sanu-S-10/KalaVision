from typing import Literal

from pydantic import BaseModel

ModelStatus = Literal["connected", "unavailable", "demo_mode"]


class ModelInfo(BaseModel):
    name: str
    type: str  # e.g. "mudra" | "expression"
    model_type: str  # e.g. "tensorflow", "pytorch", "yolo", "mediapipe", "mock"
    version: str
    status: ModelStatus
    supported_classes: int
    accuracy: float | None = None
    integration: Literal["in_process", "http_api", "mock"] = "mock"
    detail: str | None = None  # human-readable note, e.g. an error message


class AIStatusResponse(BaseModel):
    demo_mode: bool
    mudra_model: ModelInfo
    expression_model: ModelInfo
