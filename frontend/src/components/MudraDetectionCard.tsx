import React from "react";
import { Text, View } from "react-native";

import { ConfidenceBar } from "./ConfidenceBar";
import { Badge } from "./ui/Badge";
import { Card } from "./ui/Card";
import type { CombinedPrediction } from "@/types";
import { sourceLabel } from "@/utils/modelSource";

/**
 * The centerpiece of the Live Performance screen: shows the currently
 * detected mudra, facial expression, model confidence for each, and the
 * generated interpretation — all driven by one CombinedPrediction, the
 * standardized shape both the mock and (later) real models return.
 *
 * Low-confidence results are shown as "Uncertain prediction" (per
 * `is_uncertain`, set server-side from the configured confidence
 * threshold) instead of being presented as a confirmed mudra/expression.
 */
export function MudraDetectionCard({ prediction }: { prediction: CombinedPrediction | null }) {
  if (!prediction) {
    return (
      <Card>
        <Text className="text-ivory/60 text-center py-6">
          Waiting for the first detection...
        </Text>
      </Card>
    );
  }

  const { mudra, expression, interpretation } = prediction;

  return (
    <Card>
      <View className="flex-row justify-between items-start mb-3">
        <View>
          <Text className="text-ivory/50 text-xs uppercase tracking-wide">Mudra</Text>
          {mudra.is_uncertain ? (
            <>
              <Text className="text-ivory/70 text-lg italic">Uncertain prediction</Text>
              <Text className="text-ivory/40 text-xs">(best guess: {mudra.name})</Text>
            </>
          ) : (
            <Text className="text-ivory text-2xl font-bold">{mudra.name}</Text>
          )}
        </View>
        <View className="items-end">
          <Text className="text-ivory/50 text-xs uppercase tracking-wide">Expression</Text>
          {expression.is_uncertain ? (
            <Text className="text-ivory/70 text-base italic">Uncertain</Text>
          ) : (
            <Text className="text-gold400 text-xl font-semibold">{expression.name}</Text>
          )}
        </View>
      </View>

      <View className="flex-row flex-wrap gap-1.5 mb-1">
        {expression.rasa ? <Badge label={`Rasa: ${expression.rasa}`} tone="emerald" /> : null}
        {/* One badge per model: they can differ (e.g. real mudra model with
            a mock expression model), and a mixed result must never read as
            fully real. */}
        <Badge label={`Mudra: ${sourceLabel(mudra.source).label}`} tone={sourceLabel(mudra.source).tone} />
        <Badge
          label={`Expression: ${sourceLabel(expression.source).label}`}
          tone={sourceLabel(expression.source).tone}
        />
        {(mudra.is_uncertain || expression.is_uncertain) && (
          <Badge label="Low confidence" tone="vermilion" />
        )}
      </View>

      <View className="mt-4">
        <ConfidenceBar label="Mudra confidence" confidence={mudra.confidence} tone="gold" />
        <ConfidenceBar label="Expression confidence" confidence={expression.confidence} tone="emerald" />
      </View>

      {interpretation ? (
        <View className="mt-3 pt-3 border-t border-ivory/10">
          <Text className="text-ivory/50 text-xs uppercase tracking-wide mb-1">Interpretation</Text>
          <Text className="text-ivory/90 text-sm leading-5">{interpretation}</Text>
        </View>
      ) : null}
    </Card>
  );
}
