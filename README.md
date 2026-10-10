# KalaVision AI

An intelligent cultural performance recognition and story interpretation platform for Kathakali — featuring real-time camera-based and recorded video mudra (hand gesture) recognition, MediaPipe hand landmark extraction, temporal smoothing, audience-friendly narrative interpretation, and instant report export (PDF, CSV, JSON).

Built as a single cross-platform application (Web + Android) with a FastAPI backend and Expo React Native frontend.

**Key Architecture Update (v2.0):** KalaVision AI operates completely standalone with **zero MongoDB database requirements** and **no login or user authentication**. Kathakali mudra definitions, Navarasa expressions, cultural knowledge articles, and traditional story scenes are organized into structured local JSON files.

---

## 1. System Architecture

```
React Native (Expo) + Expo Router
        │  REST (Axios) + WebSocket
        ▼
FastAPI Backend
        │
        ▼
AI Adapter Layer (services/ai/)
        ├── KalaVisionMudraAdapter (Real in-process: MediaPipe 21 landmarks + Random Forest)
        └── ExpressionModelAdapter (In-process or HTTP real model adapter ready)
        │
        ▼
Detection / Sequence Context Engine (services/context_engine.py)
        │
        ▼
Story Interpretation Engine (services/story_engine.py — rule-based cultural narration)
        │
        ▼
Local Knowledge Repository (app/data/ — mudras.json, expressions.json, stories.json, cultural_knowledge.json)
        │
        ▼
In-Memory Transient Session Store & Report Engine (PDF, CSV, JSON export)
```

### Processing Pipeline (Live Camera or Uploaded Video)

```
Camera / Video Upload
    -> Frame Extraction & Decoding (OpenCV)
    -> Frame Sampling (configurable FPS, default 2.0)
    -> MediaPipe HandLandmarker (21 3D hand coordinates)
    -> Wrist-Centered Landmark Normalization
    -> 30 Geometric Feature Vector Extraction
    -> Random Forest 24-Class Mudra Prediction + Confidence Score
    -> Temporal Smoothing (5-frame majority vote filter)
    -> Sequence Context Engine (held gesture vs transition tracking)
    -> Local Cultural Knowledge Base Lookup
    -> Story Interpretation (audience-facing narrative beat)
    -> Live UI Timeline & Instant PDF/CSV/JSON Report Export
```

---

## 2. Standalone & Database-Free Architecture

1. **No MongoDB Requirement:**
   - No MongoDB Atlas or local `mongod` process required.
   - All cultural data resides in version-controlled, high-performance local JSON files under `backend/app/data/`.
   - `KnowledgeRepository` loads and indexes mudras, expressions, stories, and articles directly into memory for instant O(1) lookups.

2. **No Login or Authentication:**
   - The app launches directly into the main Dashboard without prompting for credentials.
   - All endpoints, WebSocket streams, and video analysis tools are open and accessible immediately.

3. **In-Memory Transient Session Store:**
   - Active and recent sessions are tracked in memory (`session_store.py`) to power real-time WebSocket sessions and video analysis.
   - Reports (PDF, CSV, JSON) can be exported directly from analysis results or active sessions without database writes.

---

## 3. Real Mudra Classification Model

The mudra classification model package lives in `backend/models/mudra/`:

- `kathakali_mudra_random_forest.pkl`: Scikit-learn Random Forest classifier trained on Kathakali mudras.
- `class_names.npy`: Class labels for the 24 canonical single-hand mudras (Asamyukta Hastas).
- `hand_landmarker.task`: Google MediaPipe hand landmark detection task model.
- `feature_extractor.py`: Geometric feature extraction module generating 30 hand geometry features.
- `model_info.txt`: Model metadata and held-out test accuracy (~74.2%).

**Real Inference by Default:** `DEMO_MODE=false` and `MUDRA_MODEL_MODE=real` are enabled by default. The real model is loaded at backend startup. If model files are ever missing or fail to load, a clear `unavailable` status is reported rather than presenting random mock predictions as real AI recognition.

---

## 4. Local Cultural Knowledge Base

Located in `backend/app/data/`:

- **`mudras.json`**: The 24 classical single-hand mudras (Pataka, Mudrakhya, Kataka, Mushti, Kartarimukha, Sukatunda, Kappitthaka, Hamsapaksha, Sikhara, Hamsasyam, Anjali, Ardhachandra, Mukura, Bhramara, Suchimukha, Pallava, Tripataka, Mrigasirsha, Sarpasira, Vardhamanaka, Arala, Urnanabha, Mukula, Katakamugha) with meanings, traditional order, descriptions, and theatrical usages.
- **`expressions.json`**: The 9 classical Navarasas (Shringara, Hasya, Karuna, Raudra, Veera, Bhayanaka, Bibhatsa, Adbhuta, Shanta) with rasa names, narrative tones, and facial descriptions.
- **`cultural_knowledge.json`**: Articles covering Kathakali history, character archetype Veshams (Paccha, Kathi, Thadi, Kari, Minukku), and music/rhythm grammar.
- **`stories.json`**: Classical Attakatha plays (Kalyanasougandhikam, Nalacharitham, Duryodhana Vadham) with character breakdowns, settings, and scene-by-scene narrative timelines.

---

## 5. API Reference

### Health & AI Model Status
- `GET /api/health` — System health check (database: none, auth: disabled).
- `GET /api/ai/status` — Status of Mudra and Expression models (connected, unavailable).
- `POST /api/ai/test/mudra` — Connectivity and inference test for the mudra classifier.
- `POST /api/ai/test/expression` — Connectivity test for the expression detector.

### Prediction & Vision
- `POST /api/predict/mudra` — Predict mudra from a base64 frame.
- `POST /api/predict/expression` — Predict expression from a base64 frame.
- `POST /api/predict/combined` — Predict combined mudra + expression with narrative interpretation.
- `WS /api/ws/live` — WebSocket stream for camera frames; receives base64 frame, returns smoothed detection and story beats.

### Performances & Video Analysis
- `POST /api/performances` — Create transient performance session.
- `GET /api/performances/{id}` — Get session info.
- `POST /api/performances/{id}/analyze-video` — Upload video, sample frames, classify mudras, and build narrative timeline.
- `GET /api/performances/{id}/report?format=pdf|csv|json` — Export performance report.
- `POST /api/performances/report/generate?format=pdf|csv|json` — Direct report generation from payload data.

### Cultural Knowledge & Stories
- `GET /api/knowledge/mudras` — List all 24 mudra definitions.
- `GET /api/knowledge/mudras/{id}` — Get single mudra details.
- `GET /api/knowledge/expressions` — List Navarasas.
- `GET /api/knowledge/articles` — List cultural articles.
- `GET /api/knowledge/stories` — List traditional plays and scene timelines.
- `GET /api/story/library` — Story narrative library.
- `POST /api/story/event` — Generate a single narrative beat from gesture and emotion.

---

## 6. Setup and Running Instructions

### Prerequisites
- Python 3.10+ (tested with Python 3.14)
- Node.js 18+ and npm
- Webcam or video files for testing

### Quick Start (Run Both Backend & Frontend with One Command)

From the project root directory (`kalavision-ai`):

```bash
# 1. Install root dependencies (concurrently)
npm install

# 2. Install Python backend dependencies
pip install -r backend/requirements.txt

# 3. Install frontend dependencies
npm --prefix frontend install

# 4. Run both Backend & Web Frontend concurrently
npm run dev
```

This concurrently starts:
- **FastAPI backend** on `http://localhost:8000` (auto-reloading, with docs at `/docs`)
- **Expo React Native frontend** on `http://localhost:8081` (Web platform)

#### Additional Root Scripts:
- `npm run dev:android` — Concurrently runs the backend and launches the frontend for Android
- `npm run backend` — Starts only the FastAPI backend (`uvicorn app.main:app`)
- `npm run frontend` — Starts only the Expo web frontend
- `npm run test:backend` — Runs backend unit tests (`pytest`)
- `npm run typecheck:frontend` — Runs frontend TypeScript check (`tsc --noEmit`)

---

### Running Services Separately (Optional)

#### Backend Setup
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
The API is available at `http://localhost:8000`. Interactive OpenAPI documentation is accessible at `http://localhost:8000/docs`.

#### Frontend Setup
```bash
cd frontend
npm install
npm run web       # For Web
# or
npm run android   # For Android
```
The application opens directly to the Dashboard at `http://localhost:8081`.

---

## 7. Verification and Testing

### Backend Tests
Run the comprehensive pytest suite:

```bash
cd backend
python -m pytest -v
```

All 13 test suites validate:
- Standalone health check and AI model status
- Local JSON knowledge repository lookups for mudras, expressions, stories, and articles
- Rule-based story engine narrative generation
- In-memory session tracking and report rendering (PDF, CSV, JSON)
- Canonical mudra name mapping and MediaPipe landmark normalization

### Frontend Typechecking & Web Build

```bash
cd frontend

# TypeScript check
npx tsc --noEmit

# Production web export
npx expo export -p web
```
