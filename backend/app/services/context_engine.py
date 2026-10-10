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
    expression_name: str
    timestamp: float


@dataclass
class PerformanceContext:
    is_held_gesture: bool  # same mudra as the previous detection
    hold_count: int  # how many consecutive detections (post-smoothing) share this mudra
    previous_mudra: str | None
    expression_changed: bool
    recent_sequence: list[str] = field(default_factory=list)  # last few distinct mudra names, oldest first
    # Structured context, supplied by the caller where available (e.g. set
    # on the Performance record). Both optional — most performances won't
    # have them, and the story engine degrades gracefully when absent.
    character: str | None = None
    scene: str | None = None


class SequenceContextEngine:
    """Stateless by design — callers pass in whatever history they have
    (per-performance, from the DB, or per-session, in memory) and get back
    a PerformanceContext for the newest point. Keeping it stateless makes
    it trivially reusable from both the live WebSocket path and the
    video-analysis batch path."""

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
                expression_changed=False, recent_sequence=[],
                character=character, scene=scene,
            )

        current = history[-1]
        previous = history[-2] if len(history) >= 2 else None

        is_held = previous is not None and previous.mudra_name == current.mudra_name
        expression_changed = previous is not None and previous.expression_name != current.expression_name

        hold_count = 1
        for point in reversed(history[:-1]):
            if point.mudra_name == current.mudra_name:
                hold_count += 1
            else:
                break

        # Distinct mudra names, most-recent-first, deduped consecutively, oldest-first for display
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
            expression_changed=expression_changed,
            recent_sequence=distinct_recent,
            character=character,
            scene=scene,
        )
