import { apiClient } from "./client";
import type { KathakaliStory, StorySoFar } from "@/types";

export async function getStorySoFar(performanceId: string): Promise<StorySoFar> {
  const { data } = await apiClient.get<StorySoFar>(`/api/story/${performanceId}`);
  return data;
}

export async function getStoryLibrary(): Promise<KathakaliStory[]> {
  const { data } = await apiClient.get<KathakaliStory[]>("/api/story/library");
  return data;
}
