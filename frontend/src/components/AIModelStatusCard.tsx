import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { getAIStatus, testExpressionModel, testMudraModel } from "@/api/aiStatus";
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

function summarizeStatuses(
  a: ModelStatus | undefined,
  b: ModelStatus | undefined
): { label: string; tone: "emerald" | "gold" | "vermilion" } {
  if (a === "unavailable" || b === "unavailable") return { label: "A model is unavailable", tone: "vermilion" };
  if (a === "connected" && b === "connected") return { label: "Real models active", tone: "emerald" };
  if (a === "demo_mode" && b === "demo_mode") return { label: "Demo Mode active", tone: "gold" };
  return { label: "Partly real (some models are mock)", tone: "gold" };
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
    <View className="py-2.5 border-b border-ivory/10 last:border-b-0">
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
 * can always see which models (mock, connected real model, or
 * unavailable) are currently active, and quickly verify a real adapter
 * is actually reachable without running a full performance. */
export function AIModelStatusCard() {
  const [mudra, setMudra] = useState<ModelInfo | null>(null);
  const [expression, setExpression] = useState<ModelInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testingMudra, setTestingMudra] = useState(false);
  const [testingExpression, setTestingExpression] = useState(false);
  const [mudraTestResult, setMudraTestResult] = useState<string | null>(null);
  const [expressionTestResult, setExpressionTestResult] = useState<string | null>(null);

  useEffect(() => {
    getAIStatus()
      .then((res) => {
        setMudra(res.mudra_model);
        setExpression(res.expression_model);
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

  const handleTestExpression = async () => {
    setTestingExpression(true);
    setExpressionTestResult(null);
    try {
      const result = await testExpressionModel();
      setExpressionTestResult(`OK — "${result.name}" (${Math.round(result.confidence * 100)}%, ${result.source})`);
    } catch (e) {
      setExpressionTestResult(describeApiError(e));
    } finally {
      setTestingExpression(false);
    }
  };

  const overall = summarizeStatuses(mudra?.status, expression?.status);

  return (
    <Card>
      <View className="flex-row justify-between items-center mb-1">
        <Text className="text-ivory/50 text-xs uppercase tracking-wide">AI Model Status</Text>
        {mudra && expression ? (
          // Derived from each model's own status, not the global demo flag:
          // the models can differ (real mudra model + mock expression model).
          <Badge label={overall.label} tone={overall.tone} />
        ) : null}
      </View>
      {error ? <Text className="text-vermilion500 text-sm">{error}</Text> : null}
      {mudra ? (
        <ModelRow info={mudra} onTest={handleTestMudra} testing={testingMudra} testResult={mudraTestResult} />
      ) : null}
      {expression ? (
        <ModelRow
          info={expression}
          onTest={handleTestExpression}
          testing={testingExpression}
          testResult={expressionTestResult}
        />
      ) : null}
    </Card>
  );
}
