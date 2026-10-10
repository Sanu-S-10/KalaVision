import { apiClient } from "./client";
import type { AIStatusResponse, MudraPrediction } from "@/types";

export async function getAIStatus(): Promise<AIStatusResponse> {
  const { data } = await apiClient.get<AIStatusResponse>("/api/ai/status");
  return data;
}

/**
 * Connectivity check for whichever mudra adapter is currently registered
 * — lets a teammate verify their real model is wired up correctly without
 * running a full live performance or video upload.
 */
export async function testMudraModel(): Promise<MudraPrediction> {
  const { data } = await apiClient.post<MudraPrediction>("/api/ai/test/mudra");
  return data;
}

