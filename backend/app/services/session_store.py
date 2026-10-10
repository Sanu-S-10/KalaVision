"""
In-memory session store for active and completed performance sessions.
Provides transient storage for video analysis and live camera sessions
so reports and timelines can be exported directly without database persistence.
"""
from datetime import datetime, timezone
from typing import Any
import uuid


class SessionStore:
    def __init__(self, max_sessions: int = 50):
        self._sessions: dict[str, dict[str, Any]] = {}
        self._max_sessions = max_sessions

    def create_session(
        self,
        title: str,
        mode: str = "live",
        character: str | None = None,
        scene: str | None = None,
        story_title: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        sid = session_id or str(uuid.uuid4())
        session = {
            "id": sid,
            "title": title,
            "mode": mode,
            "character": character,
            "scene": scene,
            "story_title": story_title,
            "status": "in_progress",
            "started_at": datetime.now(timezone.utc),
            "ended_at": None,
            "detections": [],
            "story_events": [],
        }
        # LRU cleanup if exceeded
        if len(self._sessions) >= self._max_sessions:
            oldest_key = next(iter(self._sessions))
            self._sessions.pop(oldest_key, None)

        self._sessions[sid] = session
        return session

    def get_session(self, session_id: str) -> dict[str, Any] | None:
        return self._sessions.get(session_id)

    def end_session(self, session_id: str) -> dict[str, Any] | None:
        session = self._sessions.get(session_id)
        if session:
            session["status"] = "completed"
            session["ended_at"] = datetime.now(timezone.utc)
        return session

    def add_detection(self, session_id: str, detection: dict[str, Any]) -> None:
        session = self._sessions.get(session_id)
        if session:
            session["detections"].append(detection)

    def add_story_event(self, session_id: str, event: dict[str, Any]) -> None:
        session = self._sessions.get(session_id)
        if session:
            session["story_events"].append(event)

    def list_sessions(self) -> list[dict[str, Any]]:
        return list(self._sessions.values())


# Singleton session store
session_store = SessionStore()
