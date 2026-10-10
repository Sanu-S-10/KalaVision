import { apiClient } from "./client";
import type { MudraPrediction } from "@/types";

export async function predictMudra(
  imageBase64: string,
  performanceId?: string,
  timestamp?: number
): Promise<MudraPrediction> {
  const { data } = await apiClient.post<MudraPrediction>("/api/predict/mudra", {
    image_base64: imageBase64,
    performance_id: performanceId,
    timestamp,
  });
  return data;
}

