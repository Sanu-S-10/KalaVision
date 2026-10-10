from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.prediction import PredictionSource


class PerformanceCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    mode: str = Field(description="'live' or 'video'")
    story_title: str | None = None
    video_url: str | None = None
    # Optional structured context (see services/context_engine.py) — when
    # supplied, the Story Engine can frame events as "As <character> in
    # the <scene> scene, ..." without inventing either value itself.
    character: str | None = None
    scene: str | None = None


class PerformanceResponse(BaseModel):
    id: str
    user_id: str | None = None
    title: str
    mode: str
    story_title: str | None = None
    video_url: str | None = None
    character: str | None = None
    scene: str | None = None
    status: str  # "in_progress" | "completed"
    started_at: datetime
    ended_at: datetime | None = None
    detection_count: int = 0
    duration_seconds: float | None = None


class OriginalPrediction(BaseModel):
    mudra_name: str
    mudra_confidence: float
    expression_name: str
    expression_confidence: float
    source: str | None = None
    model_version: str | None = None
    expression_source: str | None = None


class DetectionEvent(BaseModel):
    id: str | None = None
    performance_id: str
    mudra_name: str
    mudra_confidence: float
    expression_name: str
    expression_confidence: float
    interpretation: str | None = None
    timestamp: float
    created_at: datetime | None = None

    source: PredictionSource = "real"
    model_version: str = "1.0"
    expression_source: PredictionSource | None = None
    expression_model_version: str | None = None
    mudra_is_uncertain: bool = False
    expression_is_uncertain: bool = False

    is_corrected: bool = False
    original_prediction: OriginalPrediction | None = None
    reviewed_by: str | None = None
    reviewed_at: datetime | None = None

    is_deleted: bool = False
    deleted_at: datetime | None = None
