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

/** One summary label for a detection made of two models. They can differ
 * (real mudra model + mock expression model), and the summary must never
 * claim "real" for a result that is only partly real. */
export function overallSourceLabel(
  mudra: PredictionSource,
  expression: PredictionSource
): { label: string; tone: SourceTone } {
  if (mudra === "real" && expression === "real") return { label: "REAL AI MODEL", tone: "emerald" };
  if (mudra === "real") return { label: "REAL MUDRA · MOCK EXPRESSION", tone: "gold" };
  if (expression === "real") return { label: "MOCK MUDRA · REAL EXPRESSION", tone: "gold" };
  return { label: "DEMO / MOCK MODEL", tone: "neutral" };
}
