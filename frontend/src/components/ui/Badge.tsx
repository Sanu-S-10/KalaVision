import React from "react";
import { Text, View } from "react-native";

interface BadgeProps {
  label: string;
  tone?: "gold" | "emerald" | "vermilion" | "neutral";
}

const TONE_STYLES: Record<NonNullable<BadgeProps["tone"]>, string> = {
  gold: "bg-gold500/20 border-gold500",
  emerald: "bg-emerald500/20 border-emerald500",
  vermilion: "bg-vermilion500/20 border-vermilion500",
  neutral: "bg-ivory/10 border-ivory/30",
};

const TONE_TEXT: Record<NonNullable<BadgeProps["tone"]>, string> = {
  gold: "text-gold400",
  emerald: "text-emerald500",
  vermilion: "text-vermilion500",
  neutral: "text-ivory",
};

const TONE_FALLBACK_STYLE: Record<NonNullable<BadgeProps["tone"]>, object> = {
  gold: { backgroundColor: "rgba(212, 160, 51, 0.18)", borderColor: "#D4A033" },
  emerald: { backgroundColor: "rgba(31, 111, 84, 0.22)", borderColor: "#1F6F54" },
  vermilion: { backgroundColor: "rgba(199, 62, 29, 0.22)", borderColor: "#C73E1D" },
  neutral: { backgroundColor: "rgba(245, 237, 224, 0.10)", borderColor: "rgba(245, 237, 224, 0.3)" },
};

const TONE_FALLBACK_TEXT: Record<NonNullable<BadgeProps["tone"]>, object> = {
  gold: { color: "#E8B84B" },
  emerald: { color: "#10B981" },
  vermilion: { color: "#EF4444" },
  neutral: { color: "#F5EDE0" },
};

export function Badge({ label, tone = "neutral" }: BadgeProps) {
  return (
    <View
      className={`self-start px-2.5 py-1 rounded-full border ${TONE_STYLES[tone]}`}
      style={TONE_FALLBACK_STYLE[tone]}
    >
      <Text
        className={`text-xs font-medium ${TONE_TEXT[tone]}`}
        style={TONE_FALLBACK_TEXT[tone]}
      >
        {label}
      </Text>
    </View>
  );
}
