import React from "react";
import { ScrollView, Text, View } from "react-native";

import { AIModelStatusCard } from "@/components/AIModelStatusCard";
import { Card } from "@/components/ui/Card";

export default function SettingsScreen() {
  return (
    <ScrollView
      className="flex-1 bg-maroon950"
      contentContainerClassName="p-5 pb-10"
      style={{ backgroundColor: "#1A0F0A" }}
      contentContainerStyle={{ maxWidth: 1000, width: "100%", alignSelf: "center" }}
    >
      <Text className="text-ivory text-xl font-bold mb-4">Settings & Configuration</Text>

      <View className="mb-4">
        <AIModelStatusCard />
      </View>

      <Card className="mb-4">
        <Text className="text-ivory/50 text-xs uppercase tracking-wide mb-3">
          AI Inference & Smoothing Parameters
        </Text>

        <View className="gap-2.5">
          <View className="flex-row justify-between items-center py-1 border-b border-ivory/10">
            <Text className="text-ivory/80 text-sm">Confidence Threshold</Text>
            <Text className="text-gold400 font-semibold text-sm">0.55 (55%)</Text>
          </View>

          <View className="flex-row justify-between items-center py-1 border-b border-ivory/10">
            <Text className="text-ivory/80 text-sm">Temporal Smoothing Window</Text>
            <Text className="text-gold400 font-semibold text-sm">5 frames</Text>
          </View>

          <View className="flex-row justify-between items-center py-1 border-b border-ivory/10">
            <Text className="text-ivory/80 text-sm">Live Camera Sampling Rate</Text>
            <Text className="text-gold400 font-semibold text-sm">2.0 FPS</Text>
          </View>

          <View className="flex-row justify-between items-center py-1 border-b border-ivory/10">
            <Text className="text-ivory/80 text-sm">Default Video Sampling Rate</Text>
            <Text className="text-gold400 font-semibold text-sm">2.0 FPS</Text>
          </View>

          <View className="flex-row justify-between items-center py-1 border-b border-ivory/10">
            <Text className="text-ivory/80 text-sm">MediaPipe Landmarks</Text>
            <Text className="text-gold400 font-semibold text-sm">21 points (3D)</Text>
          </View>

          <View className="flex-row justify-between items-center py-1">
            <Text className="text-ivory/80 text-sm">Supported Mudra Classes</Text>
            <Text className="text-gold400 font-semibold text-sm">24 Mudras</Text>
          </View>
        </View>
      </Card>

      <Card className="mb-4">
        <Text className="text-ivory/50 text-xs uppercase tracking-wide mb-1">Architecture</Text>
        <Text className="text-ivory/70 text-sm leading-5">
          KalaVision AI runs completely standalone with zero database dependencies.
          Kathakali mudra definitions, cultural knowledge, story narratives, and scene data are
          powered by organized local JSON files.
        </Text>
      </Card>

      <Text className="text-ivory/40 text-xs text-center mt-2">
        KalaVision AI · Version 2.0.0 (Standalone Architecture)
      </Text>
    </ScrollView>
  );
}
