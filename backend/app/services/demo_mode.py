"""
Demo Mode — simulates a complete Kathakali performance end-to-end
(changing mudras, expressions, confidences, timestamps, interpretations,
and story events) so the whole app can be demoed without a physical camera.
Used by the WebSocket handler when a client explicitly connects with `?demo=true`.
"""
import asyncio
import random
from collections.abc import AsyncGenerator

from app.schemas.prediction import CombinedPrediction, ExpressionPrediction, MudraPrediction
from app.services.ai.mock_expression_detector import EXPRESSIONS, MOCK_MODEL_VERSION as EXPR_MODEL_VERSION
from app.services.ai.mock_mudra_detector import MUDRA_NAMES, MOCK_MODEL_VERSION as MUDRA_MODEL_VERSION
from app.services.context_engine import DetectionPoint, SequenceContextEngine
from app.services.knowledge_repository import get_knowledge_repository
from app.services.story_engine import get_story_engine
from app.utils.confidence import is_uncertain


async def simulate_performance(
    interval_seconds: float = 2.5,
    max_events: int | None = None,
) -> AsyncGenerator[dict, None]:
    """Yields a steady stream of combined detection + story events, as if a
    live performance were happening right now. Stops after `max_events`
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
        expression = rng.choice(EXPRESSIONS)

        mudra_confidence = round(rng.uniform(0.70, 0.98), 4)
        expr_confidence = round(rng.uniform(0.65, 0.96), 4)

        mudra = MudraPrediction(
            name=mudra_name, confidence=mudra_confidence, timestamp=t,
            source="mock", model_version=MUDRA_MODEL_VERSION,
            is_uncertain=is_uncertain(mudra_confidence),
        )
        expr = ExpressionPrediction(
            name=expression["name"], confidence=expr_confidence, timestamp=t, rasa=expression["rasa"],
            source="mock", model_version=EXPR_MODEL_VERSION,
            is_uncertain=is_uncertain(expr_confidence),
        )

        history.append(DetectionPoint(mudra_name, expression["name"], t))
        context = context_engine.build_context(history)

        story_line = await story_engine.generate_event(
            mudra_name, expression["name"], t, events_so_far, context, knowledge
        )
        events_so_far.append(story_line)

        combined = CombinedPrediction(mudra=mudra, expression=expr, interpretation=story_line)

        yield {
            "type": "detection",
            "data": combined.model_dump(),
            "story_so_far": await story_engine.summarize(events_so_far),
            "is_stable": True,
        }

        count += 1
        t += interval_seconds
        await asyncio.sleep(interval_seconds)
