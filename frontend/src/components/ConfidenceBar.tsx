import React from "react";
import { Text, View } from "react-native";

interface ConfidenceBarProps {
  label: string;
  confidence: number; // 0..1
  tone?: "gold" | "emerald";
}

export function ConfidenceBar({ label, confidence, tone = "gold" }: ConfidenceBarProps) {
  const pct = Math.round(confidence * 100);
  const barColor = tone === "gold" ? "bg-gold500" : "bg-emerald500";

  return (
    <View className="mb-2">
      <View className="flex-row justify-between mb-1">
        <Text className="text-ivory/80 text-xs">{label}</Text>
        <Text className="text-ivory/80 text-xs font-semibold">{pct}%</Text>
      </View>
      <View className="h-2 bg-ivory/10 rounded-full overflow-hidden">
        <View className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
      </View>
    </View>
  );
}
