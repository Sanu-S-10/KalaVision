import { apiClient } from "./client";
import type { DetectionEvent, Performance } from "@/types";

export async function createPerformance(payload: {
  title: string;
  mode: "live" | "video";
  story_title?: string;
  video_url?: string;
}): Promise<Performance> {
  const { data } = await apiClient.post<Performance>("/api/performances", payload);
  return data;
}

export async function listPerformances(limit = 20, offset = 0): Promise<Performance[]> {
  const { data } = await apiClient.get<Performance[]>("/api/performances", { params: { limit, offset } });
  return data;
}

export async function getPerformance(id: string): Promise<Performance> {
  const { data } = await apiClient.get<Performance>(`/api/performances/${id}`);
  return data;
}

export async function endPerformance(id: string): Promise<Performance> {
  const { data } = await apiClient.post<Performance>(`/api/performances/${id}/end`);
  return data;
}

export async function listDetections(performanceId: string): Promise<DetectionEvent[]> {
  const { data } = await apiClient.get<DetectionEvent[]>(`/api/performances/${performanceId}/detections`);
  return data;
}

/**
 * Uploads a video and runs the full Video Analysis pipeline (validate ->
 * extract/sample frames -> detect -> confidence filter -> temporal
 * smoothing -> sequence/context analysis -> story interpretation ->
 * store). `sampleFps` controls how many frames per second of video are
 * actually run through detection — lower is faster for long recordings.
 */
export async function analyzeVideo(
  performanceId: string,
  fileUri: string,
  fileName: string,
  mimeType: string,
  sampleFps = 2.0
): Promise<DetectionEvent[]> {
  const form = new FormData();
  // React Native's FormData accepts this { uri, name, type } shape for
  // files picked via expo-document-picker / expo-image-picker.
  form.append("file", { uri: fileUri, name: fileName, type: mimeType } as unknown as Blob);

  const { data } = await apiClient.post<DetectionEvent[]>(
    `/api/performances/${performanceId}/analyze-video`,
    form,
    {
      params: { sample_fps: sampleFps },
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120000, // video analysis can take a while
    }
  );
  return data;
}
