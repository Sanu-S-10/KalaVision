from datetime import datetime

from pydantic import BaseModel


class StoryEventRequest(BaseModel):
    performance_id: str
    mudra_name: str
    expression_name: str
    timestamp: float


class StoryEvent(BaseModel):
    id: str | None = None
    performance_id: str
    text: str
    mudra_name: str
    expression_name: str
    timestamp: float
    created_at: datetime | None = None


class StorySoFarResponse(BaseModel):
    performance_id: str
    events: list[StoryEvent]
    summary: str
