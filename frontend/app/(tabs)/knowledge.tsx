import React, { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { describeApiError } from "@/api/client";
import { listArticles, listMudraReference } from "@/api/knowledge";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/LoadingState";
import type { KnowledgeArticle, MudraReference } from "@/types";

type Tab = "mudras" | "articles";

export default function KnowledgeBaseScreen() {
  const [tab, setTab] = useState<Tab>("mudras");
  const [mudras, setMudras] = useState<MudraReference[]>([]);
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listMudraReference(), listArticles()])
      .then(([m, a]) => {
        setMudras(m);
        setArticles(a);
      })
      .catch((err) => setError(describeApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading knowledge base..." />;

  return (
    <ScrollView
      className="flex-1 bg-maroon950"
      contentContainerClassName="p-5 pb-10"
      style={{ backgroundColor: "#1A0F0A" }}
      contentContainerStyle={{ maxWidth: 1000, width: "100%", alignSelf: "center" }}
    >
      <Text className="text-ivory text-xl font-bold mb-4">Knowledge Base</Text>

      <View className="flex-row gap-2 mb-5">
        {(["mudras", "articles"] as Tab[]).map((t) => (
          <View key={t} {...{ onTouchEnd: () => setTab(t) }}>
            <Badge label={t[0].toUpperCase() + t.slice(1)} tone={tab === t ? "gold" : "neutral"} />
          </View>
        ))}
      </View>

      {error ? <Text className="text-vermilion500 mb-3">{error}</Text> : null}

      {tab === "mudras" &&
        mudras.map((m) => (
          <Card key={m._id} className="mb-2.5">
            <Text className="text-ivory font-semibold">{m.name}</Text>
            <Text className="text-ivory/60 text-sm mt-1">{m.meaning}</Text>
          </Card>
        ))}

      {tab === "articles" &&
        articles.map((a) => (
          <Card key={a._id} className="mb-2.5">
            <Text className="text-ivory font-semibold mb-1">{a.title}</Text>
            <Badge label={a.category} tone="gold" />
            <Text className="text-ivory/70 text-sm mt-2 leading-5">{a.body}</Text>
          </Card>
        ))}
    </ScrollView>
  );
}

