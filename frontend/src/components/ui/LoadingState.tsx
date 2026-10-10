import React from "react";
import { ActivityIndicator, Text, View } from "react-native";

export function LoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <View className="flex-1 items-center justify-center py-16">
      <ActivityIndicator size="large" color="#D4A033" />
      <Text className="text-ivory/70 mt-3">{message}</Text>
    </View>
  );
}
