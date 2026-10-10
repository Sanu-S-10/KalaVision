"""
KalaVision Mudra Classifier — real MudraModelAdapter (in-process).

Pipeline per frame:

    JPEG bytes
      -> decode (OpenCV)
      -> MediaPipe HandLandmarker (hand_landmarker.task)  -> 21 landmarks (x, y, z)
      -> normalize_landmarks()      (wrist-centered, scaled by hand size)
      -> create_geometric_features() (from the model package: 30 features)
      -> RandomForest.predict_proba  -> top class + probability
      -> MudraPrediction(source="real", ...)

The model package lives in `backend/models/mudra/` (override with
MUDRA_MODEL_DIR) and is self-contained, so a newer export from the model's
author can be dropped in without touching app code:

    kathakali_mudra_random_forest.pkl   scikit-learn RandomForest (joblib format)
    class_names.npy                      class labels, in the model's class order
    hand_landmarker.task                 MediaPipe hand landmark model
    feature_extractor.py                 create_geometric_features(X) from the model's author
    model_info.txt                       free-text metadata (accuracy is read from here)

Nothing heavy happens at import or construction: the model is loaded
lazily (or by warm_up() at startup) and a missing/incompatible model
produces a clear `unavailable` status instead of crashing the API.

NOTE ON PICKLES: loading a .pkl/.joblib file executes code, so only load
model files that come from your own team. The pickle was saved with
scikit-learn 1.6.1 — keep that version pinned (see requirements.txt),
because sklearn pickles are not guaranteed to load across versions.
"""
import asyncio
import importlib.util
import re
import threading
from pathlib import Path

import numpy as np

from app.schemas.ai_status import ModelInfo
from app.schemas.prediction import BoundingBox, MudraPrediction
from app.services.ai.base import ModelUnavailableError, MudraModelAdapter, NoDetectionError
# The canonical mudra names used by the Knowledge Base (see
# app/data/mudras.json). The model's own labels are mapped onto these so the Story
# Engine can look each prediction up in the local Knowledge Base.
from app.services.ai.mock_mudra_detector import MUDRA_NAMES
from app.utils.confidence import is_uncertain

MODEL_NAME = "KalaVision Mudra Classifier"
_BACKEND_DIR = Path(__file__).resolve().parents[3]  # .../backend

_RF_FILE = "kathakali_mudra_random_forest.pkl"
_CLASSES_FILE = "class_names.npy"
_LANDMARKER_FILE = "hand_landmarker.task"
_FEATURES_FILE = "feature_extractor.py"
_INFO_FILE = "model_info.txt"


def canonical_mudra_name(raw_label: str) -> str:
    """Map a model class label to the Knowledge Base's mudra name.

    The model's labels are the training dataset's folder names, e.g.
    "1. Pathaaka (Flag)" or "17.Thripathaaka(Flag with three colours)".
    The leading number is the mudra's traditional position (1-24), which is
    also its position in MUDRA_NAMES, so "1. Pathaaka (Flag)" -> "Pataka".
    Labels without a recognizable number fall back to the label with any
    number prefix and parenthetical stripped."""
    match = re.match(r"^\s*(\d+)\s*\.", raw_label)
    if match:
        number = int(match.group(1))
        if 1 <= number <= len(MUDRA_NAMES):
            return MUDRA_NAMES[number - 1]
    cleaned = re.sub(r"^\s*\d+\s*\.\s*", "", raw_label)
    cleaned = re.sub(r"\(.*?\)", "", cleaned).strip()
    return cleaned or raw_label


def normalize_landmarks(points: np.ndarray) -> np.ndarray | None:
    """(21, 3) MediaPipe landmarks -> wrist-centered, scaled so that the
    wrist -> middle-finger-base (landmark 9) distance is 1.

    This step is NOT part of the model package (feature_extractor.py only
    computes features from already-normalized landmarks), so it was inferred
    from the trained forest: its split thresholds (e.g. wrist->fingertip
    distances of ~1.4-2.0, finger lengths of ~0.7-1.1) only make sense for
    landmarks divided by hand size, and real hand photos fall inside the
    trained feature ranges under this normalization (24/30 features vs 8/30
    for raw coordinates). If the model's author used a different
    normalization, THIS function is the only place to change.

    Returns None if the hand is degenerate (zero size)."""
    centered = points - points[0]
    scale = float(np.linalg.norm(centered[9]))
    if scale < 1e-6:
        return None
    return centered / scale


class KalaVisionMudraAdapter(MudraModelAdapter):
    def __init__(
        self,
        model_dir: str | Path = "models/mudra",
        version: str = "1.0",
        min_hand_detection_confidence: float = 0.5,
    ):
        path = Path(model_dir)
        self.model_dir = path if path.is_absolute() else _BACKEND_DIR / path
        self.version = version
        self._min_hand_confidence = min_hand_detection_confidence

        self._load_lock = threading.Lock()      # guards one-time loading
        self._infer_lock = threading.Lock()     # MediaPipe landmarker is not safe to share across threads
        self._loaded = False
        self._load_error: str | None = None
        self._rf = None
        self._landmarker = None
        self._create_features = None
        self._class_labels: list[str] = []
        self._class_names: list[str] = []
        self._accuracy: float | None = None
        self._mp = None

    # ------------------------------------------------------------------ loading
    def _load(self) -> None:
        """Loads everything once. Raises ModelUnavailableError with a clear
        reason on any failure (missing file, missing dependency, version
        mismatch) and remembers it, so later calls fail fast with the same
        message instead of retrying a 50MB load on every frame."""
        if self._loaded:
            return
        with self._load_lock:
            if self._loaded:
                return
            if self._load_error:
                raise ModelUnavailableError(MODEL_NAME, self._load_error)
            try:
                self._load_unlocked()
                self._loaded = True
            except ModelUnavailableError as exc:
                self._load_error = exc.detail
                raise
            except Exception as exc:  # any other load failure -> unavailable, never a crash
                self._load_error = f"Failed to load model: {type(exc).__name__}: {exc}"
                raise ModelUnavailableError(MODEL_NAME, self._load_error) from exc

    def _load_unlocked(self) -> None:
        for filename in (_RF_FILE, _CLASSES_FILE, _LANDMARKER_FILE, _FEATURES_FILE):
            if not (self.model_dir / filename).is_file():
                raise ModelUnavailableError(
                    MODEL_NAME, f"Model file '{filename}' not found in {self.model_dir}"
                )

        try:
            import joblib
            import mediapipe as mp
            from mediapipe.tasks import python as mp_python
            from mediapipe.tasks.python import vision
        except ImportError as exc:
            raise ModelUnavailableError(
                MODEL_NAME,
                f"Missing dependency ({exc.name}). Install scikit-learn==1.6.1 and mediapipe "
                f"(see requirements.txt).",
            ) from exc

        rf = joblib.load(self.model_dir / _RF_FILE)
        rf.n_jobs = 1  # single-frame inference: avoid spinning up a thread pool per call

        labels = [str(x) for x in np.load(self.model_dir / _CLASSES_FILE)]
        if len(labels) != len(rf.classes_):
            raise ModelUnavailableError(
                MODEL_NAME,
                f"class_names.npy has {len(labels)} labels but the model has {len(rf.classes_)} classes.",
            )

        # feature_extractor.py is the model author's code; load it from the
        # model package so features always match the pickle it shipped with.
        spec = importlib.util.spec_from_file_location(
            "kalavision_mudra_feature_extractor", self.model_dir / _FEATURES_FILE
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        create_features = module.create_geometric_features

        landmarker = vision.HandLandmarker.create_from_options(
            vision.HandLandmarkerOptions(
                base_options=mp_python.BaseOptions(
                    model_asset_path=str(self.model_dir / _LANDMARKER_FILE)
                ),
                running_mode=vision.RunningMode.IMAGE,  # frames are independent samples, not a continuous video
                num_hands=1,  # these are single-hand mudras
                min_hand_detection_confidence=self._min_hand_confidence,
            )
        )

        self._rf = rf
        self._class_labels = labels
        self._class_names = [canonical_mudra_name(label) for label in labels]
        self._create_features = create_features
        self._landmarker = landmarker
        self._mp = mp
        self._accuracy = self._read_test_accuracy()

    def _read_test_accuracy(self) -> float | None:
        info = self.model_dir / _INFO_FILE
        if not info.is_file():
            return None
        match = re.search(r"Test accuracy:\s*([\d.]+)\s*%", info.read_text(errors="ignore"))
        return round(float(match.group(1)) / 100.0, 4) if match else None

    # --------------------------------------------------------------- inference
    def _predict_sync(self, image_bytes: bytes, timestamp: float) -> MudraPrediction:
        import cv2

        self._load()

        bgr = cv2.imdecode(np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
        if bgr is None:
            raise NoDetectionError(MODEL_NAME, "The frame could not be decoded as an image.")
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)

        mp_image = self._mp.Image(image_format=self._mp.ImageFormat.SRGB, data=rgb)
        with self._infer_lock:
            result = self._landmarker.detect(mp_image)
        if not result.hand_landmarks:
            raise NoDetectionError(MODEL_NAME, "No hand detected in the frame.")

        points = np.array([[p.x, p.y, p.z] for p in result.hand_landmarks[0]], dtype=np.float64)
        normalized = normalize_landmarks(points)
        if normalized is None:
            raise NoDetectionError(MODEL_NAME, "Hand landmarks were degenerate (zero hand size).")

        features = self._create_features(normalized.reshape(1, -1))
        probabilities = self._rf.predict_proba(features)[0]
        best = int(np.argmax(probabilities))
        confidence = float(probabilities[best])

        xs, ys = points[:, 0], points[:, 1]
        box = BoundingBox(
            x=float(xs.min()), y=float(ys.min()),
            width=float(xs.max() - xs.min()), height=float(ys.max() - ys.min()),
        )
        return MudraPrediction(
            name=self._class_names[best],
            confidence=round(confidence, 4),
            timestamp=timestamp,
            bounding_box=box,
            source="real",
            model_version=self.version,
            is_uncertain=is_uncertain(confidence),
        )

    async def predict(self, image_bytes: bytes, timestamp: float) -> MudraPrediction:
        # MediaPipe + the forest are CPU-bound and synchronous; run them in a
        # worker thread so a slow frame never blocks the event loop (and with
        # it every other WebSocket connection).
        return await asyncio.to_thread(self._predict_sync, image_bytes, timestamp)

    async def predict_batch(self, image_bytes_list: list[bytes], start_timestamp: float = 0.0) -> list[MudraPrediction]:
        """One prediction per frame WHERE A HAND WAS FOUND — frames with no
        hand are omitted (each prediction carries its own timestamp)."""
        results = []
        for i, frame in enumerate(image_bytes_list):
            try:
                results.append(await self.predict(frame, start_timestamp + i))
            except NoDetectionError:
                continue
        return results

    # ------------------------------------------------------------------ status
    async def warm_up(self) -> None:
        """Load the model now (called at startup) so the first live frame
        doesn't pay the load time. Failures are recorded, not raised."""
        try:
            await asyncio.to_thread(self._load)
        except ModelUnavailableError:
            pass

    async def get_status(self) -> ModelInfo:
        try:
            await asyncio.to_thread(self._load)
        except ModelUnavailableError as exc:
            return ModelInfo(
                name=MODEL_NAME, type="mudra", model_type="random_forest + mediapipe hand landmarks",
                version=self.version, status="unavailable", supported_classes=0,
                accuracy=None, integration="in_process", detail=exc.detail,
            )
        return ModelInfo(
            name=MODEL_NAME, type="mudra", model_type="random_forest + mediapipe hand landmarks",
            version=self.version, status="connected", supported_classes=len(self._class_names),
            accuracy=self._accuracy, integration="in_process",
            detail="Accuracy shown is the held-out test accuracy from model_info.txt.",
        )
