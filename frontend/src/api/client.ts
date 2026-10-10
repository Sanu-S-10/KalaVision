import axios from "axios";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";
export const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? "ws://localhost:8000";

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 60000,
});

export function describeApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    // Structured errors from the AI endpoints (model_unavailable, no_detection)
    if (detail && typeof detail === "object" && typeof detail.message === "string") {
      return detail.message;
    }
    if (!error.response) return "Couldn't reach the server. Check your connection and the API URL.";
    return `Request failed (${error.response.status}).`;
  }
  return "Something went wrong.";
}
