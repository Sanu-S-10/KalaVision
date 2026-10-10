"""
Confidence thresholding — one small, shared rule so "uncertain" is defined
identically everywhere (REST responses, WebSocket stream, stored
detections, analytics) instead of being re-implemented per call site.
"""
from app.config import settings


def is_uncertain(confidence: float, threshold: float | None = None) -> bool:
    """True if `confidence` is below the configured minimum. A prediction
    at or above the threshold is treated as a confirmed result; below it,
    the frontend shows "Uncertain prediction" rather than presenting a
    guess as settled fact. Example: with the default 0.55 threshold, a
    42% confidence mudra prediction comes back marked uncertain."""
    cutoff = threshold if threshold is not None else settings.confidence_threshold
    return confidence < cutoff
