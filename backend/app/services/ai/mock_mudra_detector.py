"""
MockMudraDetector — generates realistic-looking demo predictions.

Implements the same interface as a real `MudraModelAdapter` (see base.py)
so it's a true drop-in for development/demo, not a special case the rest
of the app has to know about. Replace it with a real adapter once your
teammates' mudra-recognition model is ready — nothing else needs to change.
"""
import random

from app.schemas.ai_status import ModelInfo
from app.schemas.prediction import BoundingBox, LandmarkPoint, MudraPrediction
from app.services.ai.base import MudraModelAdapter
from app.utils.confidence import is_uncertain

# Canonical hand landmark template (21 points) for demo visualization
CANONICAL_HAND_TEMPLATE = [
    (0.50, 0.80),  # 0: wrist
    (0.42, 0.72), (0.36, 0.62), (0.32, 0.52), (0.28, 0.45),  # 1-4: thumb
    (0.42, 0.55), (0.40, 0.42), (0.39, 0.32), (0.38, 0.22),  # 5-8: index
    (0.50, 0.54), (0.50, 0.40), (0.50, 0.29), (0.50, 0.18),  # 9-12: middle
    (0.58, 0.55), (0.60, 0.42), (0.61, 0.32), (0.62, 0.24),  # 13-16: ring
    (0.65, 0.60), (0.68, 0.50), (0.70, 0.42), (0.72, 0.34),  # 17-20: pinky
]

# The 24 single-handed Kathakali mudras.
MUDRA_NAMES = [
    "Pataka", "Mudrakhya", "Kataka", "Mushti", "Kartarimukha",
    "Sukatunda", "Kappitthaka", "Hamsapaksha", "Sikhara", "Hamsasyam",
    "Anjali", "Ardhachandra", "Mukura", "Bhramara", "Suchimukha",
    "Pallava", "Tripataka", "Mrigasirsha", "Sarpasira", "Vardhamanaka",
    "Arala", "Urnanabha", "Mukula", "Katakamugha",
]

MOCK_MODEL_VERSION = "mock-1.0"


class MockMudraDetector(MudraModelAdapter):
    def __init__(self, seed: int | None = None):
        self._rng = random.Random(seed)

    async def predict(self, image_bytes: bytes, timestamp: float) -> MudraPrediction:
        name = self._rng.choice(MUDRA_NAMES)
        confidence = round(self._rng.uniform(0.60, 0.98), 4)
        box = BoundingBox(
            x=round(self._rng.uniform(0.1, 0.4), 3),
            y=round(self._rng.uniform(0.1, 0.4), 3),
            width=round(self._rng.uniform(0.2, 0.35), 3),
            height=round(self._rng.uniform(0.2, 0.35), 3),
        )
        # Add slight natural jitter to template points
        landmarks = [
            LandmarkPoint(
                x=round(max(0.05, min(0.95, px + self._rng.uniform(-0.015, 0.015))), 4),
                y=round(max(0.05, min(0.95, py + self._rng.uniform(-0.015, 0.015))), 4),
                z=0.0,
            )
            for px, py in CANONICAL_HAND_TEMPLATE
        ]
        return MudraPrediction(
            name=name,
            confidence=confidence,
            timestamp=timestamp,
            bounding_box=box,
            landmarks=landmarks,
            all_hands=[landmarks],
            hand_detected=True,
            source="mock",
            model_version=MOCK_MODEL_VERSION,
            is_uncertain=is_uncertain(confidence),
        )

    async def predict_batch(self, image_bytes_list: list[bytes], start_timestamp: float = 0.0) -> list[MudraPrediction]:
        results = []
        for i, frame in enumerate(image_bytes_list):
            results.append(await self.predict(frame, start_timestamp + i))
        return results

    async def get_status(self) -> ModelInfo:
        return ModelInfo(
            name="MockMudraDetector",
            type="mudra",
            model_type="mock",
            version=MOCK_MODEL_VERSION,
            # A mock only exists in the registry when it was chosen (DEMO_MODE or a
            # per-model "mock" mode), so whenever it is answering it is, by
            # definition, running as a demo/mock model.
            status="demo_mode",
            supported_classes=len(MUDRA_NAMES),
            accuracy=None,
            integration="mock",
            detail="Generates random demo predictions; not a trained model.",
        )
