import type { PredictionSource } from "@/types";

export type SourceTone = "emerald" | "gold" | "neutral";

/** Label for where a single prediction came from. Wording is deliberate:
 * the UI must always make clear whether a result is from a real AI model
 * or a demo/mock one. */
export function sourceLabel(source: PredictionSource | null | undefined): { label: string; tone: SourceTone } {
  if (source === "real") return { label: "REAL AI MODEL", tone: "emerald" };
  if (source === "user_corrected") return { label: "Corrected (reviewed)", tone: "gold" };
  return { label: "DEMO / MOCK MODEL", tone: "neutral" };
}

