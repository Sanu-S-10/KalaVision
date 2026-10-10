import { apiClient } from "./client";
import type { AIStatusResponse, ExpressionPrediction, MudraPrediction } from "@/types";

export async function getAIStatus(): Promise<AIStatusResponse> {
  const { data } = await apiClient.get<AIStatusResponse>("/api/ai/status");
  return data;
}

/**
 * Connectivity check for whichever mudra/expression adapter is currently
 * registered — lets a teammate verify their real model is wired up
 * correctly without running a full live performance or video upload. No
 * image is required; the backend uses a tiny synthetic placeholder frame
 * when none is sent.
 */
export async function testMudraModel(): Promise<MudraPrediction> {
  const { data } = await apiClient.post<MudraPrediction>("/api/ai/test/mudra");
  return data;
}

export async function testExpressionModel(): Promise<ExpressionPrediction> {
  const { data } = await apiClient.post<ExpressionPrediction>("/api/ai/test/expression");
  return data;
}
