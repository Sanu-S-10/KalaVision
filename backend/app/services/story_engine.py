"""
Story Interpretation engine — rule-based cultural knowledge interpretation system.

It takes a (mudra, expression, timestamp, previous events) tuple, plus
optional structural context (held gesture / sequence, and optionally
character/scene — see services/context_engine.py), and produces an
audience-friendly sentence plus an updated "Story So Far".

Cultural meaning comes directly from the local Knowledge Base (mudras.json,
expressions.json) via KnowledgeRepository.
"""
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

from app.services.knowledge_repository import get_knowledge_repository

if TYPE_CHECKING:
    from app.services.context_engine import PerformanceContext
    from app.services.knowledge_repository import KnowledgeRepository


class StoryEngine(ABC):
    @abstractmethod
    async def generate_event(
        self,
        mudra_name: str,
        timestamp: float,
        previous_events: list[str],
        context: "PerformanceContext | None" = None,
        knowledge: "KnowledgeRepository | None" = None,
        expression_name: str | None = None,
    ) -> str:
        raise NotImplementedError

    @abstractmethod
    async def summarize(self, events: list[str]) -> str:
        raise NotImplementedError


class RuleBasedStoryEngine(StoryEngine):
    async def generate_event(
        self,
        mudra_name: str,
        timestamp: float,
        previous_events: list[str],
        context: "PerformanceContext | None" = None,
        knowledge: "KnowledgeRepository | None" = None,
        expression_name: str | None = None,
    ) -> str:
        minute, second = divmod(int(timestamp), 60)
        time_label = f"{minute:02d}:{second:02d}"

        repo = knowledge or get_knowledge_repository()
        meaning = await repo.get_mudra_meaning(mudra_name)

        if meaning is None:
            return (
                f"[{time_label}] Detected gesture \"{mudra_name}\" "
                f"— cultural interpretation unavailable (not yet in the knowledge base)."
            )

        lead_in = "The performer forms"
        scene_prefix = ""
        if context is not None:
            if context.is_held_gesture and context.hold_count >= 3:
                lead_in = "The performer continues to hold"
            elif context.previous_mudra and context.previous_mudra != mudra_name:
                lead_in = f"Transitioning from {context.previous_mudra}, the performer forms"

            if context.character or context.scene:
                who = context.character or "The performer"
                where = f" in the {context.scene} scene" if context.scene else ""
                scene_prefix = f"As {who}{where}, "
                lead_in = lead_in[0].lower() + lead_in[1:]

        return (
            f"[{time_label}] {scene_prefix}{lead_in} {meaning}, "
            "communicating dramatic intention through classical Kathakali hasta grammar."
        )

    async def summarize(self, events: list[str]) -> str:
        if not events:
            return "The performance hasn't begun yet — the story will build here as mudras are detected."
        if len(events) == 1:
            return "The story has just begun: " + events[0]
        return (
            f"So far, {len(events)} narrative beats have unfolded, moving from the opening gesture "
            f"through to the most recent moment: \"{events[-1]}\""
        )


def get_story_engine() -> StoryEngine:
    return RuleBasedStoryEngine()
