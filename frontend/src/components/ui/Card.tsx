import React from "react";
import { View, ViewProps } from "react-native";

export function Card({ children, className = "", style, ...rest }: ViewProps & { className?: string }) {
  return (
    <View
      className={`bg-maroon900 border border-gold600/30 rounded-2xl p-4 ${className}`}
      style={[{ backgroundColor: "#2B1710", borderColor: "rgba(184, 132, 42, 0.3)" }, style]}
      {...rest}
    >
      {children}
    </View>
  );
}
