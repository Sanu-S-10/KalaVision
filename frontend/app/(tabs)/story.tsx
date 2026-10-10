import React, { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { describeApiError } from "@/api/client";
import { getStoryLibrary } from "@/api/story";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/LoadingState";
import type { KathakaliStory } from "@/types";

export default function StoryInterpretationScreen() {
  const [stories, setStories] = useState<KathakaliStory[]>([]);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStoryLibrary()
      .then((data) => {
        setStories(data);
        if (data.length > 0) setSelectedStoryId(data[0].id);
      })
      .catch((e) => setError(describeApiError(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading Kathakali stories..." />;

  const currentStory = stories.find((s) => s.id === selectedStoryId) || stories[0];

  return (
    <ScrollView
      className="flex-1 bg-maroon950"
      contentContainerClassName="p-5 pb-10"
      style={{ backgroundColor: "#1A0F0A" }}
      contentContainerStyle={{ maxWidth: 1000, width: "100%", alignSelf: "center" }}
    >
      <Text className="text-ivory text-xl font-bold mb-1">Story Interpretation</Text>
      <Text className="text-ivory/60 text-sm mb-4">
        Classical Kathakali plays, characters, and scene-by-scene gestural narratives.
      </Text>

      {/* Story tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-4"
        contentContainerClassName="gap-2"
      >
        {stories.map((s) => (
          <View key={s.id} {...{ onTouchEnd: () => setSelectedStoryId(s.id) }}>
            <Badge
              label={s.title}
              tone={selectedStoryId === s.id ? "gold" : "neutral"}
            />
          </View>
        ))}
      </ScrollView>

      {error ? <Text className="text-vermilion500 mb-3">{error}</Text> : null}

      {currentStory ? (
        <>
          {/* Story summary card */}
          <Card className="mb-4 bg-gold500/10 border-gold500/40">
            <View className="flex-row justify-between items-start mb-1">
              <Text className="text-gold400 font-bold text-lg">{currentStory.title}</Text>
              <Badge label={currentStory.playwright} tone="gold" />
            </View>
            <Text className="text-ivory/80 text-sm mt-1 leading-5">
              {currentStory.description}
            </Text>
          </Card>

          {/* Dramatis Personae */}
          <Text className="text-ivory text-base font-semibold mb-2">Characters & Veshams</Text>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {currentStory.characters.map((c, idx) => (
              <Card key={idx} className="flex-1 min-w-[140px] p-3">
                <Text className="text-ivory font-semibold text-sm">{c.name}</Text>
                <Badge label={c.vesham} tone="emerald" />
                <Text className="text-ivory/60 text-xs mt-1">{c.role}</Text>
              </Card>
            ))}
          </View>

          {/* Scene by scene timeline */}
          <Text className="text-ivory text-base font-semibold mb-3">
            Scene-by-Scene Narrative Timeline
          </Text>

          {currentStory.scenes.map((scene) => (
            <Card key={scene.scene_number} className="mb-3">
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-ivory font-semibold">
                  Scene {scene.scene_number}: {scene.title}
                </Text>
                <Badge label={scene.character} tone="neutral" />
              </View>

              <Text className="text-ivory/50 text-xs mb-2">Setting: {scene.setting}</Text>

              <View className="flex-row flex-wrap gap-1.5 mb-2">
                {scene.primary_mudras.map((m) => (
                  <Badge key={m} label={`Mudra: ${m}`} tone="gold" />
                ))}
              </View>

              <Text className="text-ivory/80 text-sm leading-5 mt-1 border-t border-ivory/10 pt-2">
                {scene.narration}
              </Text>
            </Card>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}
