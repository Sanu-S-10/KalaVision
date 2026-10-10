import { router } from "expo-router";
import {
  BookOpen,
  Camera,
  Clapperboard,
  Cpu,
  Layers,
  ScrollText,
  Sparkles,
  Video,
} from "lucide-react-native";
import React, { useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";

import { AIModelStatusCard } from "@/components/AIModelStatusCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function DashboardScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const onRefresh = async () => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    setRefreshing(false);
  };

  return (
    <ScrollView
      className="flex-1 bg-maroon950"
      contentContainerClassName="p-5 pb-10"
      style={{ backgroundColor: "#1A0F0A" }}
      contentContainerStyle={{ maxWidth: 1000, width: "100%", alignSelf: "center" }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D4A033" />}
    >
      <View className="mb-4">
        <Text className="text-ivory/60 text-xs uppercase tracking-wider mb-1">
          KalaVision AI · Kathakali Recognition
        </Text>
        <Text className="text-ivory text-2xl font-bold">System Dashboard</Text>
      </View>

      {/* AI Model Status Card */}
      <View className="mb-4" key={refreshKey}>
        <AIModelStatusCard />
      </View>

      {/* Quick Launch Cards */}
      <Text className="text-ivory text-lg font-semibold mb-3">Recognition Workflows</Text>
      <View className="flex-row gap-3 mb-4">
        <Card
          className="flex-1 bg-gold500/10 border-gold500/40 p-4 justify-between"
          {...{ onTouchEnd: () => router.push("/(tabs)/live") }}
        >
          <View>
            <View className="flex-row items-center gap-2 mb-2">
              <Camera color="#D4A033" size={20} />
              <Text className="text-gold400 font-bold text-base">Live Camera</Text>
            </View>
            <Text className="text-ivory/70 text-xs leading-4">
              Stream live video frames from webcam/mobile camera for real-time mudra detection.
            </Text>
          </View>
          <View className="mt-3">
            <Button label="Open Camera" onPress={() => router.push("/(tabs)/live")} />
          </View>
        </Card>

        <Card
          className="flex-1 bg-emerald500/10 border-emerald500/40 p-4 justify-between"
          {...{ onTouchEnd: () => router.push("/(tabs)/video-analysis") }}
        >
          <View>
            <View className="flex-row items-center gap-2 mb-2">
              <Video color="#10B981" size={20} />
              <Text className="text-emerald400 font-bold text-base">Video Analysis</Text>
            </View>
            <Text className="text-ivory/70 text-xs leading-4">
              Upload recordings to extract frames, run model inference, and export reports.
            </Text>
          </View>
          <View className="mt-3">
            <Button
              label="Analyze Video"
              variant="outline"
              onPress={() => router.push("/(tabs)/video-analysis")}
            />
          </View>
        </Card>
      </View>

      {/* Technical AI Pipeline Highlights */}
      <Text className="text-ivory text-lg font-semibold mb-3">AI Vision Architecture</Text>
      <Card className="mb-4">
        <View className="gap-3">
          <View className="flex-row items-start gap-3">
            <View className="p-2 rounded-lg bg-gold500/10">
              <Cpu color="#D4A033" size={18} />
            </View>
            <View className="flex-1">
              <Text className="text-ivory font-semibold text-sm">MediaPipe Landmark Extraction</Text>
              <Text className="text-ivory/60 text-xs mt-0.5 leading-4">
                Extracts 21 3D hand coordinates per frame, normalized relative to wrist scale for invariant geometry.
              </Text>
            </View>
          </View>

          <View className="flex-row items-start gap-3">
            <View className="p-2 rounded-lg bg-emerald500/10">
              <Layers color="#10B981" size={18} />
            </View>
            <View className="flex-1">
              <Text className="text-ivory font-semibold text-sm">24-Class Random Forest Model</Text>
              <Text className="text-ivory/60 text-xs mt-0.5 leading-4">
                Calculates 30 geometric features to classify single-hand Kathakali gestures with real confidence scoring.
              </Text>
            </View>
          </View>

          <View className="flex-row items-start gap-3">
            <View className="p-2 rounded-lg bg-gold500/10">
              <Sparkles color="#D4A033" size={18} />
            </View>
            <View className="flex-1">
              <Text className="text-ivory font-semibold text-sm">Temporal Smoothing Filter</Text>
              <Text className="text-ivory/60 text-xs mt-0.5 leading-4">
                Majority-vote stabilization across recent frames eliminates flicker on held mudras.
              </Text>
            </View>
          </View>

          <View className="flex-row items-start gap-3">
            <View className="p-2 rounded-lg bg-emerald500/10">
              <ScrollText color="#10B981" size={18} />
            </View>
            <View className="flex-1">
              <Text className="text-ivory font-semibold text-sm">Rule-Based Story Interpretation</Text>
              <Text className="text-ivory/60 text-xs mt-0.5 leading-4">
                Grounds gesture sequences in Hastalakshana Deepika cultural definitions without requiring a database.
              </Text>
            </View>
          </View>
        </View>
      </Card>

      {/* Cultural Vocabulary Overview */}
      <Text className="text-ivory text-lg font-semibold mb-3">Kathakali Cultural Corpus</Text>
      <Card className="mb-4">
        <Text className="text-ivory/80 font-medium text-sm mb-2">24 Traditional Single-Hand Mudras</Text>
        <View className="flex-row flex-wrap gap-1.5 mb-4">
          {[
            "Pataka",
            "Mudrakhya",
            "Kataka",
            "Mushti",
            "Kartarimukha",
            "Sukatunda",
            "Kappitthaka",
            "Hamsapaksha",
            "Sikhara",
            "Hamsasyam",
            "Anjali",
            "Ardhachandra",
            "Mukura",
            "Bhramara",
            "Suchimukha",
            "Pallava",
            "Tripataka",
            "Mrigasirsha",
            "Sarpasira",
            "Vardhamanaka",
            "Arala",
            "Urnanabha",
            "Mukula",
            "Katakamugha",
          ].map((m) => (
            <Badge key={m} label={m} tone="gold" />
          ))}
        </View>

        <Text className="text-ivory/80 font-medium text-sm mb-2">Navarasa (Nine Facial Expressions)</Text>
        <View className="flex-row flex-wrap gap-1.5">
          {[
            "Shringara (Love)",
            "Hasya (Laughter)",
            "Karuna (Compassion)",
            "Raudra (Anger)",
            "Veera (Heroism)",
            "Bhayanaka (Fear)",
            "Bibhatsa (Disgust)",
            "Adbhuta (Wonder)",
            "Shanta (Peace)",
          ].map((r) => (
            <Badge key={r} label={r} tone="emerald" />
          ))}
        </View>
      </Card>

      {/* Direct links to Stories & Knowledge */}
      <View className="flex-row gap-3">
        <Button
          label="Explore Stories"
          variant="outline"
          onPress={() => router.push("/(tabs)/story")}
        />
        <Button
          label="Knowledge Base"
          variant="outline"
          onPress={() => router.push("/(tabs)/knowledge")}
        />
      </View>
    </ScrollView>
  );
}
