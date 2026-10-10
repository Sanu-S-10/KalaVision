"""
Demo Mode — simulates a complete Kathakali performance end-to-end
(changing mudras, confidences, timestamps, hand landmarks, interpretations,
and story events) so the whole app can be demoed without a physical camera.
Used by the WebSocket handler when a client explicitly connects with `?demo=true`.
"""
import asyncio
import random
from collections.abc import AsyncGenerator

from app.schemas.prediction import LandmarkPoint, MudraPrediction
from app.services.ai.mock_mudra_detector import (
    CANONICAL_HAND_TEMPLATE,
    MOCK_MODEL_VERSION as MUDRA_MODEL_VERSION,
    MUDRA_NAMES,
)
from app.services.context_engine import DetectionPoint, SequenceContextEngine
from app.services.knowledge_repository import get_knowledge_repository
from app.services.story_engine import get_story_engine
from app.utils.confidence import is_uncertain


async def simulate_performance(
    interval_seconds: float = 2.5,
    max_events: int | None = None,
) -> AsyncGenerator[dict, None]:
    """Yields a steady stream of mudra detection (with hand landmarks) + story events,
    as if a live performance were happening right now. Stops after `max_events`
    if given, otherwise runs until the caller stops iterating. Story text is
    grounded in the local Knowledge Base rather than skipping straight to
    "interpretation unavailable" for every mudra."""
    rng = random.Random()
    story_engine = get_story_engine()
    context_engine = SequenceContextEngine()
    knowledge = get_knowledge_repository()
    events_so_far: list[str] = []
    history: list[DetectionPoint] = []
    t = 0.0
    count = 0

    while max_events is None or count < max_events:
        mudra_name = rng.choice(MUDRA_NAMES)
        mudra_confidence = round(rng.uniform(0.70, 0.98), 4)

        landmarks = [
            LandmarkPoint(
                x=round(max(0.05, min(0.95, px + rng.uniform(-0.012, 0.012))), 4),
                y=round(max(0.05, min(0.95, py + rng.uniform(-0.012, 0.012))), 4),
                z=0.0,
            )
            for px, py in CANONICAL_HAND_TEMPLATE
        ]

        mudra = MudraPrediction(
            name=mudra_name,
            confidence=mudra_confidence,
            timestamp=t,
            source="mock",
            model_version=MUDRA_MODEL_VERSION,
            is_uncertain=is_uncertain(mudra_confidence),
            hand_detected=True,
            landmarks=landmarks,
            all_hands=[landmarks],
        )

        history.append(DetectionPoint(mudra_name=mudra_name, timestamp=t))
        context = context_engine.build_context(history)

        story_line = await story_engine.generate_event(
            mudra_name, t, events_so_far, context, knowledge
        )
        events_so_far.append(story_line)

        yield {
            "type": "detection",
            "data": {
                "mudra": mudra.model_dump(),
                "hand_detected": True,
                "landmarks": [lm.model_dump() for lm in landmarks],
                "all_hands": [[lm.model_dump() for lm in landmarks]],
                "interpretation": story_line,
                "timestamp": t,
            },
            "story_so_far": await story_engine.summarize(events_so_far),
            "is_stable": True,
        }

        count += 1
        t += interval_seconds
        await asyncio.sleep(interval_seconds)

