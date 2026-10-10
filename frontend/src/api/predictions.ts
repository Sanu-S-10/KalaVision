import { apiClient } from "./client";
import type { CombinedPrediction } from "@/types";

export async function predictCombined(
  imageBase64: string,
  performanceId?: string,
  timestamp?: number
): Promise<CombinedPrediction> {
  const { data } = await apiClient.post<CombinedPrediction>("/api/predict/combined", {
    image_base64: imageBase64,
    performance_id: performanceId,
    timestamp,
  });
  return data;
}
