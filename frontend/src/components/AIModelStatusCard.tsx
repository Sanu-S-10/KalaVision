import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { getAIStatus, testMudraModel } from "@/api/aiStatus";
import { describeApiError } from "@/api/client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { ModelInfo, ModelStatus } from "@/types";

function statusTone(status: ModelStatus): "emerald" | "gold" | "vermilion" {
  if (status === "connected") return "emerald";
  if (status === "demo_mode") return "gold";
  return "vermilion";
}

function statusLabel(status: ModelStatus): string {
  if (status === "connected") return "Connected";
  if (status === "demo_mode") return "Demo Mode";
  return "Unavailable";
}

function ModelRow({
  info,
  onTest,
  testing,
  testResult,
}: {
  info: ModelInfo;
  onTest: () => void;
  testing: boolean;
  testResult: string | null;
}) {
  return (
    <View className="py-2.5">
      <View className="flex-row justify-between items-center mb-1">
        <Text className="text-ivory font-semibold capitalize">{info.type} model</Text>
        <Badge label={statusLabel(info.status)} tone={statusTone(info.status)} />
      </View>
      <Text className="text-ivory/60 text-xs">
        {info.name} · {info.model_type} · v{info.version}
      </Text>
      <Text className="text-ivory/50 text-xs mt-0.5">
        {info.supported_classes} supported classes
        {info.accuracy != null ? ` · ${Math.round(info.accuracy * 100)}% accuracy` : ""}
      </Text>
      {info.detail ? <Text className="text-ivory/40 text-xs mt-0.5">{info.detail}</Text> : null}
      <View className="mt-2">
        <Button label={testing ? "Testing..." : "Test connectivity"} variant="outline" loading={testing} onPress={onTest} />
      </View>
      {testResult ? <Text className="text-ivory/60 text-xs mt-1.5">{testResult}</Text> : null}
    </View>
  );
}

/** AI Model Status section — shown on Dashboard and Settings so the user
 * can always see the Kathakali Mudra Classifier status (mock, connected real
 * model, or unavailable), and verify connectivity without running a full session. */
export function AIModelStatusCard() {
  const [mudra, setMudra] = useState<ModelInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testingMudra, setTestingMudra] = useState(false);
  const [mudraTestResult, setMudraTestResult] = useState<string | null>(null);

  useEffect(() => {
    getAIStatus()
      .then((res) => {
        setMudra(res.mudra_model);
      })
      .catch(() => setError("Couldn't load AI model status."));
  }, []);

  const handleTestMudra = async () => {
    setTestingMudra(true);
    setMudraTestResult(null);
    try {
      const result = await testMudraModel();
      setMudraTestResult(`OK — "${result.name}" (${Math.round(result.confidence * 100)}%, ${result.source})`);
    } catch (e) {
      setMudraTestResult(describeApiError(e));
    } finally {
      setTestingMudra(false);
    }
  };

  return (
    <Card>
      <View className="flex-row justify-between items-center mb-1">
        <Text className="text-ivory/50 text-xs uppercase tracking-wide">Mudra Classifier Status</Text>
        {mudra ? (
          <Badge label={statusLabel(mudra.status)} tone={statusTone(mudra.status)} />
        ) : null}
      </View>
      {error ? <Text className="text-vermilion500 text-sm">{error}</Text> : null}
      {mudra ? (
        <ModelRow info={mudra} onTest={handleTestMudra} testing={testingMudra} testResult={mudraTestResult} />
      ) : null}
    </Card>
  );
}

