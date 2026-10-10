from datetime import datetime, timezone
import uuid

from fastapi import APIRouter

from app.schemas.story import StoryEvent, StoryEventRequest, StorySoFarResponse
from app.services.context_engine import DetectionPoint, SequenceContextEngine
from app.services.knowledge_repository import get_knowledge_repository
from app.services.session_store import session_store
from app.services.story_engine import get_story_engine

router = APIRouter(prefix="/api/story", tags=["story"])
_context_engine = SequenceContextEngine()


@router.post("/event", response_model=StoryEvent)
async def create_story_event(payload: StoryEventRequest):
    story_engine = get_story_engine()
    knowledge = get_knowledge_repository()

    session = session_store.get_session(payload.performance_id)
    character = session.get("character") if session else None
    scene = session.get("scene") if session else None

    previous_texts = [
        e["text"] for e in (session.get("story_events", []) if session else []) if e.get("text")
    ]
    history = [
        DetectionPoint(d["mudra_name"], d["timestamp"])
        for d in (session.get("detections", []) if session else [])
    ] + [DetectionPoint(payload.mudra_name, payload.timestamp)]

    context = _context_engine.build_context(history, character=character, scene=scene)

    text = await story_engine.generate_event(
        payload.mudra_name,
        payload.timestamp,
        previous_texts,
        context,
        knowledge,
    )

    event_record = {
        "id": str(uuid.uuid4()),
        "performance_id": payload.performance_id,
        "text": text,
        "mudra_name": payload.mudra_name,
        "timestamp": payload.timestamp,
        "created_at": datetime.now(timezone.utc),
    }

    if session:
        session_store.add_story_event(payload.performance_id, event_record)

    return StoryEvent(**event_record)


@router.get("/library")
async def get_story_library():
    """Returns traditional Kathakali plays and scene breakdowns from local JSON."""
    knowledge = get_knowledge_repository()
    return await knowledge.list_stories()


@router.get("/{performance_id}", response_model=StorySoFarResponse)
async def get_story_so_far(performance_id: str):
    story_engine = get_story_engine()
    session = session_store.get_session(performance_id)

    raw_events = session.get("story_events", []) if session else []
    events: list[StoryEvent] = []
    texts: list[str] = []

    for idx, e in enumerate(raw_events):
        ev = StoryEvent(
            id=str(e.get("id", idx)),
            performance_id=performance_id,
            text=e.get("text", ""),
            mudra_name=e.get("mudra_name", "Pataka"),
            expression_name=e.get("expression_name", "Shanta"),
            timestamp=float(e.get("timestamp", 0.0)),
            created_at=e.get("created_at"),
        )
        events.append(ev)
        texts.append(ev.text)

    summary = await story_engine.summarize(texts)
    return StorySoFarResponse(performance_id=performance_id, events=events, summary=summary)
