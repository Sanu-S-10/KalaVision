import { apiClient } from "./client";
import type { ReportFormat } from "@/types";

/**
 * Fetches a performance report in the requested format for a session ID.
 */
export async function exportReport(performanceId: string, format: ReportFormat): Promise<Blob> {
  const { data } = await apiClient.get(`/api/performances/${performanceId}/report`, {
    params: { format },
    responseType: "blob",
  });
  return data;
}

/**
 * Directly generates a performance report from memory without requiring persistence.
 */
export async function generateReport(
  payload: { performance: any; detections: any[]; story_events?: any[] },
  format: ReportFormat
): Promise<Blob> {
  const { data } = await apiClient.post("/api/performances/report/generate", payload, {
    params: { format },
    responseType: "blob",
  });
  return data;
}
