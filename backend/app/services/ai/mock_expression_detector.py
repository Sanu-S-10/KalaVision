"""
MockExpressionDetector — generates realistic-looking demo predictions for
facial expression (Navarasa) recognition. See mock_mudra_detector.py and
base.py for the swap-in-a-real-model pattern this follows.
"""
import random

from app.schemas.ai_status import ModelInfo
from app.schemas.prediction import ExpressionPrediction
from app.services.ai.base import ExpressionModelAdapter
from app.utils.confidence import is_uncertain

# Navarasa — the nine classical expressions used in Kathakali.
EXPRESSIONS = [
    {"name": "Shringara", "rasa": "Love"},
    {"name": "Hasya", "rasa": "Laughter"},
    {"name": "Karuna", "rasa": "Compassion"},
    {"name": "Raudra", "rasa": "Anger"},
    {"name": "Veera", "rasa": "Heroism"},
    {"name": "Bhayanaka", "rasa": "Fear"},
    {"name": "Bibhatsa", "rasa": "Disgust"},
    {"name": "Adbhuta", "rasa": "Wonder"},
    {"name": "Shanta", "rasa": "Peace"},
]

MOCK_MODEL_VERSION = "mock-1.0"


class MockExpressionDetector(ExpressionModelAdapter):
    def __init__(self, seed: int | None = None):
        self._rng = random.Random(seed)

    async def predict(self, image_bytes: bytes, timestamp: float) -> ExpressionPrediction:
        choice = self._rng.choice(EXPRESSIONS)
        confidence = round(self._rng.uniform(0.40, 0.97), 4)  # occasionally dips below threshold on purpose
        return ExpressionPrediction(
            name=choice["name"],
            confidence=confidence,
            timestamp=timestamp,
            rasa=choice["rasa"],
            source="mock",
            model_version=MOCK_MODEL_VERSION,
            is_uncertain=is_uncertain(confidence),
        )

    async def predict_batch(self, image_bytes_list: list[bytes], start_timestamp: float = 0.0) -> list[ExpressionPrediction]:
        results = []
        for i, frame in enumerate(image_bytes_list):
            results.append(await self.predict(frame, start_timestamp + i))
        return results

    async def get_status(self) -> ModelInfo:
        return ModelInfo(
            name="MockExpressionDetector",
            type="expression",
            model_type="mock",
            version=MOCK_MODEL_VERSION,
            # A mock only exists in the registry when it was chosen (DEMO_MODE or a
            # per-model "mock" mode), so whenever it is answering it is, by
            # definition, running as a demo/mock model.
            status="demo_mode",
            supported_classes=len(EXPRESSIONS),
            accuracy=None,
            integration="mock",
            detail="Generates random demo predictions; not a trained model.",
        )
