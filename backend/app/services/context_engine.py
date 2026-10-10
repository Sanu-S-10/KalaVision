"""
Sequence / Context Engine — sits between raw (smoothed) detections and the
Story Interpretation engine.

Rather than interpreting every mudra completely independently, this module
looks at a short rolling history of recent detections (mudra + expression +
timing), plus optional structured performance info (character/scene, where
the user has supplied it), and derives a few simple, deterministic facts
about what's happening — "the performer is holding this gesture", "this is
a new gesture following that one", "the expression just shifted" — that
the story engine weaves into its sentence. It does NOT invent specific
cultural meaning itself (that comes from the knowledge base via
services/knowledge_repository.py); it only adds *structural* context
(timing/repetition/sequence/character/scene), keeping the output
culturally conservative and deterministic as required.

This is intentionally simple (a final-year-project-appropriate rule set,
not a learned model) and is the extension point for a future, richer
context model if one is ever added.
"""
from dataclasses import dataclass, field


@dataclass
class DetectionPoint:
    mudra_name: str
    timestamp: float


@dataclass
class PerformanceContext:
    is_held_gesture: bool  # same mudra as the previous detection
    hold_count: int  # how many consecutive detections share this mudra
    previous_mudra: str | None
    recent_sequence: list[str] = field(default_factory=list)
    character: str | None = None
    scene: str | None = None


class SequenceContextEngine:
    def build_context(
        self,
        history: list[DetectionPoint],
        max_sequence_len: int = 4,
        character: str | None = None,
        scene: str | None = None,
    ) -> PerformanceContext:
        if not history:
            return PerformanceContext(
                is_held_gesture=False, hold_count=1, previous_mudra=None,
                recent_sequence=[], character=character, scene=scene,
            )

        current = history[-1]
        previous = history[-2] if len(history) >= 2 else None
        is_held = previous is not None and previous.mudra_name == current.mudra_name

        hold_count = 1
        for point in reversed(history[:-1]):
            if point.mudra_name == current.mudra_name:
                hold_count += 1
            else:
                break

        distinct_recent: list[str] = []
        for point in reversed(history):
            if not distinct_recent or distinct_recent[-1] != point.mudra_name:
                distinct_recent.append(point.mudra_name)
            if len(distinct_recent) >= max_sequence_len:
                break
        distinct_recent.reverse()

        return PerformanceContext(
            is_held_gesture=is_held,
            hold_count=hold_count,
            previous_mudra=previous.mudra_name if previous else None,
            recent_sequence=distinct_recent,
            character=character,
            scene=scene,
        )
