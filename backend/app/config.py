"""
Central app configuration, loaded from environment variables / .env.
Every other module should import `settings` from here rather than
reading os.environ directly, so there's a single source of truth.
"""
from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    app_env: str = "development"
    cors_origins: str = "http://localhost:8081,http://localhost:19006,http://localhost:3000,http://127.0.0.1:8081"

    # AI / Demo
    # When true, prediction endpoints and the WebSocket can use mock
    # detectors for simulation. When false (default), the real KalaVision
    # Mudra Classifier is loaded and used. Mocks are never presented as real models.
    demo_mode: bool = False

    # Per-model mode override:
    #   "auto" - follow DEMO_MODE (true -> mock, false -> real adapter)
    #   "mock" - use mock detector
    #   "real" - always use real adapter
    mudra_model_mode: Literal["auto", "mock", "real"] = "real"

    # Where the KalaVision mudra model package lives (relative paths are
    # resolved against the backend/ folder) and the version it reports.
    mudra_model_dir: str = "models/mudra"
    mudra_model_version: str = "1.0"

    # Minimum confidence (0-1) a prediction needs to be shown as a confirmed
    # result rather than "Uncertain prediction"; see utils/confidence.py.
    confidence_threshold: float = 0.55

    # Live-detection temporal smoothing: how many recent frame predictions
    # to consider when deciding the "stable" output (majority vote), so a
    # held mudra doesn't flicker between two labels frame to frame.
    smoothing_window_size: int = 5

    # Default frames-per-second sampled from an uploaded video for
    # detection (see services/video_pipeline.py). Overridable per-request
    # via VideoAnalysisRequest.sample_fps.
    default_sample_fps: float = 2.0

    # Reference default for LIVE camera frame sampling.
    live_sample_fps: float = 2.0

    # Optional HTTP endpoints for models running as separate services.
    mudra_model_api_url: str = ""
    model_api_timeout_seconds: float = 10.0

    # Uploads
    max_upload_size_mb: int = 200
    allowed_video_extensions: str = ".mp4,.mov,.avi,.webm"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def allowed_video_extensions_list(self) -> list[str]:
        return [e.strip().lower() for e in self.allowed_video_extensions.split(",") if e.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
