import React from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline";
  loading?: boolean;
  disabled?: boolean;
}

const VARIANT_STYLES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-gold500 active:bg-gold600",
  secondary: "bg-emerald500 active:bg-emerald600",
  outline: "bg-transparent border border-gold500",
};

const VARIANT_TEXT: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "text-maroon950",
  secondary: "text-ivory",
  outline: "text-gold500",
};

const VARIANT_FALLBACK_STYLE: Record<NonNullable<ButtonProps["variant"]>, object> = {
  primary: { backgroundColor: "#D4A033" },
  secondary: { backgroundColor: "#1F6F54" },
  outline: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#D4A033" },
};

const VARIANT_FALLBACK_TEXT: Record<NonNullable<ButtonProps["variant"]>, object> = {
  primary: { color: "#1A0F0A" },
  secondary: { color: "#F5EDE0" },
  outline: { color: "#D4A033" },
};

export function Button({ label, onPress, variant = "primary", loading, disabled }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`rounded-xl px-5 py-3 items-center justify-center ${VARIANT_STYLES[variant]} ${
        disabled ? "opacity-50" : ""
      }`}
      style={[VARIANT_FALLBACK_STYLE[variant], disabled && { opacity: 0.5 }]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#1A0F0A" : "#F5EDE0"} />
      ) : (
        <Text
          className={`font-semibold text-base ${VARIANT_TEXT[variant]}`}
          style={VARIANT_FALLBACK_TEXT[variant]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
