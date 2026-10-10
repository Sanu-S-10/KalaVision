import os
import warnings

# Suppress TensorFlow / oneDNN and absl C++ verbose output before ML imports
os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=DeprecationWarning)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.services.ai.model_registry import warm_up_models
from app.routers import (
    ai_status,
    knowledge,
    performances,
    predictions,
    reports,
    story,
    websocket,
)

app = FastAPI(
    title="KalaVision AI API",
    description="Backend for the KalaVision AI Kathakali mudra & expression recognition platform.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    # Warm up real AI models at startup so the first frame runs immediately.
    # Unavailable models are recorded in /api/ai/status and never prevent the API from starting.
    await warm_up_models()


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "demo_mode": settings.demo_mode,
        "mudra_model_mode": settings.mudra_model_mode,
        "env": settings.app_env,
        "database": "none",
        "auth": "disabled",
    }


app.include_router(performances.router)
app.include_router(predictions.router)
app.include_router(story.router)
app.include_router(knowledge.router)
app.include_router(ai_status.router)
app.include_router(reports.router)
app.include_router(websocket.router)
