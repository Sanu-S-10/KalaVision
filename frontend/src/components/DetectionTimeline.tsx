import React from "react";
import { Text, View } from "react-native";

import { Badge } from "./ui/Badge";
import { Card } from "./ui/Card";
import type { DetectionEvent } from "@/types";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/** Read-only timeline (used on Live Performance / Story). For an editable
 * version with correct/delete actions, see DetectionReviewRow + the
 * History screen. */
export function DetectionTimeline({ events }: { events: DetectionEvent[] }) {
  if (events.length === 0) {
    return (
      <Card>
        <Text className="text-ivory/60 text-center py-4">No detections yet.</Text>
      </Card>
    );
  }

  return (
    <View>
      {events.map((event, idx) => {
        const uncertain = event.mudra_is_uncertain || event.expression_is_uncertain;
        return (
          <View key={event.id ?? idx} className="flex-row mb-3">
            <View className="w-14 pt-1">
              <Text className="text-ivory/40 text-xs">{formatTime(event.timestamp)}</Text>
            </View>
            <View className="flex-1 bg-maroon900 border border-gold600/20 rounded-xl p-3">
              <View className="flex-row justify-between items-center">
                <Text className="text-ivory font-semibold">
                  {uncertain ? "Uncertain prediction" : event.mudra_name}
                </Text>
                <Text className="text-gold400 text-sm">
                  {event.expression_is_uncertain ? "Uncertain" : event.expression_name}
                </Text>
              </View>
              <View className="flex-row gap-1.5 mt-1">
                {uncertain ? <Badge label="Low confidence" tone="vermilion" /> : null}
                {event.is_corrected ? <Badge label="Corrected" tone="gold" /> : null}
              </View>
              {event.interpretation ? (
                <Text className="text-ivory/70 text-xs mt-1">{event.interpretation}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
