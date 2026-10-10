import io
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.ai.mudra_rf_adapter import canonical_mudra_name, normalize_landmarks
from app.services.knowledge_repository import get_knowledge_repository
from app.services.session_store import session_store
from app.services.story_engine import get_story_engine
import numpy as np


@pytest.fixture
def client():
    return TestClient(app)


def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["database"] == "none"
    assert data["auth"] == "disabled"
    assert data["demo_mode"] is False
    assert data["mudra_model_mode"] == "real"


def test_ai_status(client):
    response = client.get("/api/ai/status")
    assert response.status_code == 200
    data = response.json()
    assert "mudra_model" in data
    assert "expression_model" not in data
    assert data["demo_mode"] is False
    assert data["mudra_model"]["name"] == "KalaVision Mudra Classifier"
    assert data["mudra_model"]["status"] in ("connected", "unavailable")


def test_knowledge_mudras(client):
    response = client.get("/api/knowledge/mudras")
    assert response.status_code == 200
    mudras = response.json()
    assert len(mudras) == 24
    names = [m["name"] for m in mudras]
    assert "Pataka" in names
    assert "Tripataka" in names
    assert "Katakamugha" in names


def test_knowledge_mudra_detail(client):
    response = client.get("/api/knowledge/mudras/pataka")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Pataka"
    assert "flag" in data["meaning"].lower()


def test_knowledge_articles(client):
    response = client.get("/api/knowledge/articles")
    assert response.status_code == 200
    articles = response.json()
    assert len(articles) >= 3


def test_knowledge_stories(client):
    response = client.get("/api/knowledge/stories")
    assert response.status_code == 200
    stories = response.json()
    assert len(stories) >= 3
    ids = [s["id"] for s in stories]
    assert "kalyanasougandhikam" in ids
    assert "nalacharitham" in ids


def test_story_library(client):
    response = client.get("/api/story/library")
    assert response.status_code == 200
    stories = response.json()
    assert len(stories) >= 3


def test_story_event_generation(client):
    payload = {
        "performance_id": "test_session_1",
        "mudra_name": "Pataka",
        "timestamp": 12.5,
    }
    response = client.post("/api/story/event", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["mudra_name"] == "Pataka"
    assert "Pataka" in data["text"] or "flag" in data["text"]


def test_performance_session_management(client):
    # 1. Create session
    payload = {
        "title": "Test Performance",
        "mode": "live",
        "character": "Bhima",
        "scene": "Forest Journey",
    }
    create_res = client.post("/api/performances", json=payload)
    assert create_res.status_code == 201
    created = create_res.json()
    assert created["title"] == "Test Performance"
    assert created["status"] == "in_progress"
    pid = created["id"]

    # 2. Get session
    get_res = client.get(f"/api/performances/{pid}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == pid

    # 3. Add detection to session
    session_store.add_detection(pid, {
        "performance_id": pid,
        "mudra_name": "Pataka",
        "mudra_confidence": 0.88,
        "interpretation": "The performer forms a flag gesture.",
        "timestamp": 2.0,
        "source": "real",
        "model_version": "1.0",
        "mudra_is_uncertain": False,
        "hand_detected": True,
        "landmarks": [{"x": 0.5, "y": 0.5, "z": 0.0}],
        "is_corrected": False,
        "is_deleted": False,
    })

    # 4. List detections
    det_res = client.get(f"/api/performances/{pid}/detections")
    assert det_res.status_code == 200
    detections = det_res.json()
    assert len(detections) == 1
    assert detections[0]["mudra_name"] == "Pataka"

    # 5. Export reports
    for fmt in ("json", "csv", "pdf"):
        rep_res = client.get(f"/api/performances/{pid}/report?format={fmt}")
        assert rep_res.status_code == 200
        assert len(rep_res.content) > 0

    # 6. End session
    end_res = client.post(f"/api/performances/{pid}/end")
    assert end_res.status_code == 200
    assert end_res.json()["status"] == "completed"


def test_direct_report_generation(client):
    payload = {
        "performance": {
            "title": "Direct Report Performance",
            "mode": "video",
            "status": "completed",
        },
        "detections": [
            {
                "timestamp": 1.0,
                "mudra_name": "Kataka",
                "mudra_confidence": 0.92,
                "interpretation": "Holding a flower delicately.",
                "source": "real",
                "mudra_is_uncertain": False,
                "is_corrected": False,
            }
        ],
        "story_events": [
            {"text": "Holding a flower delicately.", "timestamp": 1.0}
        ],
    }

    for fmt in ("json", "csv", "pdf"):
        rep_res = client.post(f"/api/performances/report/generate?format={fmt}", json=payload)
        assert rep_res.status_code == 200
        assert len(rep_res.content) > 0


def test_canonical_mudra_mapping():
    assert canonical_mudra_name("1. Pathaaka (Flag)") == "Pataka"
    assert canonical_mudra_name("17.Thripathaaka(Flag with three colours)") == "Tripataka"
    assert canonical_mudra_name("9. Sikhara (Peak)") == "Sikhara"


def test_landmark_normalization():
    points = np.zeros((21, 3))
    # Degenerate
    assert normalize_landmarks(points) is None
    # Real hand points
    points[9] = [0.0, 1.0, 0.0]
    norm = normalize_landmarks(points)
    assert norm is not None
    assert norm.shape == (21, 3)


@pytest.mark.asyncio
async def test_mock_detector_generates_landmarks():
    from app.services.ai.mock_mudra_detector import MockMudraDetector
    detector = MockMudraDetector()
    pred = await detector.predict(b"fake_jpeg", 1.0)
    assert pred.name in detector._rng.__class__.__name__ or len(pred.name) > 0
    assert pred.hand_detected is True
    assert len(pred.landmarks) == 21
    assert len(pred.all_hands) == 1
    assert len(pred.all_hands[0]) == 21
    for lm in pred.landmarks:
        assert 0.0 <= lm.x <= 1.0
        assert 0.0 <= lm.y <= 1.0

