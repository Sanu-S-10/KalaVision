"""
Temporal / prediction smoothing for live detection.

Frame-by-frame predictions on a held mudra can flicker (e.g.
Pataka -> Tripataka -> Pataka -> Tripataka) even when the performer isn't
moving, simply because each frame is classified independently. This module
keeps a short rolling window of recent raw predictions per session and
returns the majority-vote "stable" label, so the UI shows one steady
result instead of a flicker — while still preserving the original
timestamp and confidence of the frame that produced the stable output.

Usage: one PredictionSmoother per live session (e.g. one per WebSocket
connection), fed one raw prediction at a time.
"""
from collections import Counter, deque
from dataclasses import dataclass

from app.config import settings


@dataclass
class SmoothedResult:
    name: str
    confidence: float
    timestamp: float
    is_stable: bool  # True once the window has enough agreement to call it "settled"


class PredictionSmoother:
    def __init__(self, window_size: int | None = None):
        self.window_size = window_size or settings.smoothing_window_size
        self._window: deque[tuple[str, float, float]] = deque(maxlen=self.window_size)

    def push(self, name: str, confidence: float, timestamp: float) -> SmoothedResult:
        self._window.append((name, confidence, timestamp))

        names = [n for n, _, _ in self._window]
        counts = Counter(names)
        stable_name, stable_count = counts.most_common(1)[0]

        # Average confidence of just the frames that agreed with the
        # winning label — a truer picture than averaging everything.
        agreeing = [c for n, c, _ in self._window if n == stable_name]
        avg_confidence = sum(agreeing) / len(agreeing)

        is_stable = stable_count >= max(2, (self.window_size // 2) + 1)

        return SmoothedResult(
            name=stable_name,
            confidence=round(avg_confidence, 4),
            timestamp=timestamp,  # always the latest frame's timestamp
            is_stable=is_stable,
        )

    def reset(self) -> None:
        self._window.clear()
