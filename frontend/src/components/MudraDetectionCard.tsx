import React from "react";
import { Text, View } from "react-native";

import { ConfidenceBar } from "./ConfidenceBar";
import { Badge } from "./ui/Badge";
import { Card } from "./ui/Card";
import type { LiveDetectionPayload, MudraPrediction } from "@/types";
import { sourceLabel } from "@/utils/modelSource";

/**
 * Centerpiece of detection display: shows the currently detected Kathakali mudra,
 * model confidence, model source (Real AI vs Demo), hand tracking status, and
 * the cultural story interpretation.
 */
export function MudraDetectionCard({
  prediction,
}: {
  prediction: (LiveDetectionPayload | MudraPrediction) | null;
}) {
  if (!prediction) {
    return (
      <Card>
        <Text className="text-ivory/60 text-center py-6">
          Waiting for hand gesture detection...
        </Text>
      </Card>
    );
  }

  // Handle both LiveDetectionPayload and direct MudraPrediction
  const mudra: MudraPrediction = "mudra" in prediction ? prediction.mudra : prediction;
  const interpretation = "interpretation" in prediction ? prediction.interpretation : null;
  const handDetected = "hand_detected" in prediction ? prediction.hand_detected : mudra.hand_detected;

  return (
    <Card>
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1 mr-3">
          <Text className="text-ivory/50 text-xs uppercase tracking-wide">Kathakali Mudra</Text>
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
          <Text className="text-ivory/50 text-xs uppercase tracking-wide">Timestamp</Text>
          <Text className="text-gold400 text-base font-semibold">{mudra.timestamp.toFixed(1)}s</Text>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-1.5 mb-2">
        <Badge
          label={`Model: ${sourceLabel(mudra.source).label}`}
          tone={sourceLabel(mudra.source).tone}
        />
        {handDetected !== false ? (
          <Badge label="21 Hand Landmarks Tracked" tone="emerald" />
        ) : (
          <Badge label="Hand Not Detected" tone="vermilion" />
        )}
        {mudra.is_uncertain && <Badge label="Low confidence" tone="vermilion" />}
      </View>

      <View className="mt-3">
        <ConfidenceBar label="Mudra Recognition Confidence" confidence={mudra.confidence} tone="gold" />
      </View>

      {interpretation ? (
        <View className="mt-3 pt-3 border-t border-ivory/10">
          <Text className="text-ivory/50 text-xs uppercase tracking-wide mb-1">Cultural Interpretation</Text>
          <Text className="text-ivory/90 text-sm leading-5">{interpretation}</Text>
        </View>
      ) : null}
    </Card>
  );
}

