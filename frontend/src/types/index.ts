export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type PredictionSource = "real" | "mock" | "user_corrected";

// The standardized shape every mudra model returns.
export interface MudraPrediction {
  name: string;
  confidence: number;
  timestamp: number;
  bounding_box?: BoundingBox | null;
  source: PredictionSource;
  model_version: string;
  is_uncertain: boolean;
}

// The standardized shape every expression model returns.
export interface ExpressionPrediction {
  name: string;
  confidence: number;
  timestamp: number;
  rasa?: string | null;
  source: PredictionSource;
  model_version: string;
  is_uncertain: boolean;
}

export interface CombinedPrediction {
  mudra: MudraPrediction;
  expression: ExpressionPrediction;
  interpretation?: string | null;
}

export interface Performance {
  id: string;
  user_id?: string | null;
  title: string;
  mode: "live" | "video";
  story_title?: string | null;
  video_url?: string | null;
  character?: string | null;
  scene?: string | null;
  status: "in_progress" | "completed";
  started_at: string;
  ended_at?: string | null;
  detection_count: number;
  duration_seconds?: number | null;
}

export interface OriginalPrediction {
  mudra_name: string;
  mudra_confidence: number;
  expression_name: string;
  expression_confidence: number;
  source?: string | null;
  model_version?: string | null;
  expression_source?: string | null;
}

export interface DetectionEvent {
  id?: string;
  performance_id: string;
  mudra_name: string;
  mudra_confidence: number;
  expression_name: string;
  expression_confidence: number;
  interpretation?: string | null;
  timestamp: number;
  created_at?: string;
  source: PredictionSource;
  model_version: string;
  expression_source?: PredictionSource | null;
  expression_model_version?: string | null;
  mudra_is_uncertain: boolean;
  expression_is_uncertain: boolean;
  is_corrected: boolean;
  original_prediction?: OriginalPrediction | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  is_deleted: boolean;
  deleted_at?: string | null;
}

export interface StoryEvent {
  id?: string;
  performance_id: string;
  text: string;
  mudra_name: string;
  expression_name: string;
  timestamp: number;
  created_at?: string;
}

export interface StorySoFar {
  performance_id: string;
  events: StoryEvent[];
  summary: string;
}

export interface KnowledgeArticle {
  _id: string;
  id?: string;
  title: string;
  category: string;
  body: string;
}

export interface MudraReference {
  _id: string;
  id?: string;
  name: string;
  meaning: string;
  order: number;
  description?: string;
  usage?: string;
}

export interface ExpressionReference {
  _id: string;
  id?: string;
  name: string;
  rasa: string;
  tone?: string;
  description: string;
}

export interface KathakaliCharacter {
  name: string;
  vesham: string;
  role: string;
}

export interface KathakaliScene {
  scene_number: number;
  title: string;
  setting: string;
  character: string;
  primary_mudras: string[];
  primary_expressions: string[];
  narration: string;
}

export interface KathakaliStory {
  id: string;
  title: string;
  playwright: string;
  description: string;
  characters: KathakaliCharacter[];
  scenes: KathakaliScene[];
}

// WebSocket message envelope sent by the /api/ws/live endpoint
export interface LiveDetectionMessage {
  type: "detection";
  data: CombinedPrediction;
  story_so_far: string;
  is_stable?: boolean;
  session_id?: string;
}

export interface LiveErrorMessage {
  type: "error";
  error: "model_unavailable" | string;
  model?: string;
  message: string;
}

export interface LiveNoDetectionMessage {
  type: "no_detection";
  model?: string;
  message: string;
  timestamp?: number;
}

export type LiveSocketMessage = LiveDetectionMessage | LiveErrorMessage | LiveNoDetectionMessage;

// --- AI Model Status (GET /api/ai/status) ---
export type ModelStatus = "connected" | "unavailable" | "demo_mode";
export type ModelIntegration = "in_process" | "http_api" | "mock";

export interface ModelInfo {
  name: string;
  type: string;
  model_type: string;
  version: string;
  status: ModelStatus;
  supported_classes: number;
  accuracy?: number | null;
  integration: ModelIntegration;
  detail?: string | null;
}

export interface AIStatusResponse {
  demo_mode: boolean;
  mudra_model: ModelInfo;
  expression_model: ModelInfo;
}

export type ReportFormat = "json" | "csv" | "pdf";
