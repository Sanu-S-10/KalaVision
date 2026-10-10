import React from "react";
import { Text, View } from "react-native";

import { Button } from "./Button";

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center py-16 px-6">
      <Text className="text-ivory text-lg font-semibold text-center">{title}</Text>
      {description ? (
        <Text className="text-ivory/60 text-sm text-center mt-2">{description}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <View className="mt-4">
          <Button label={actionLabel} onPress={onAction} variant="outline" />
        </View>
      ) : null}
    </View>
  );
}
