import { apiClient } from "./client";
import type { KathakaliStory, KnowledgeArticle, MudraReference } from "@/types";

export async function listMudraReference(): Promise<MudraReference[]> {
  const { data } = await apiClient.get<MudraReference[]>("/api/knowledge/mudras");
  return data;
}

export async function listArticles(category?: string): Promise<KnowledgeArticle[]> {
  const { data } = await apiClient.get<KnowledgeArticle[]>("/api/knowledge/articles", {
    params: category ? { category } : undefined,
  });
  return data;
}

export async function listStories(): Promise<KathakaliStory[]> {
  const { data } = await apiClient.get<KathakaliStory[]>("/api/knowledge/stories");
  return data;
}

export async function getStory(id: string): Promise<KathakaliStory> {
  const { data } = await apiClient.get<KathakaliStory>(`/api/knowledge/stories/${id}`);
  return data;
}

