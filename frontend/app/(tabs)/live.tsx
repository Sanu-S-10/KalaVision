import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { describeApiError } from "@/api/client";
import { createPerformance, endPerformance } from "@/api/performances";
import { generateReport } from "@/api/reports";
import { CameraCapture } from "@/components/CameraCapture";
import { DetectionTimeline } from "@/components/DetectionTimeline";
import { MudraDetectionCard } from "@/components/MudraDetectionCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useLiveDetectionSocket } from "@/hooks/useWebSocket";
import { saveOrShareBlob } from "@/utils/exportFile";
import { overallSourceLabel } from "@/utils/modelSource";
import type { CombinedPrediction, DetectionEvent, LiveErrorMessage, ReportFormat } from "@/types";

const DEFAULT_SAMPLE_FPS = Number(process.env.EXPO_PUBLIC_LIVE_SAMPLE_FPS ?? 2);
const SAMPLE_FPS_OPTIONS = [1, 2, 3, 5];

const REPORT_MIME: Record<ReportFormat, string> = {
  json: "application/json",
  csv: "text/csv",
  pdf: "application/pdf",
};

/**
 * Live Performance screen — camera-to-AI pipeline:
 *
 *   Camera (CameraCapture)
 *     -> sample frames at configurable FPS
 *     -> WebSocket (useLiveDetectionSocket)
 *     -> FastAPI -> KalaVision Mudra Classifier (Random Forest + MediaPipe)
 *     -> confidence filtering -> temporal smoothing
 *     -> Detection Event back over WebSocket
 *     -> UI (MudraDetectionCard, DetectionTimeline, Report Export)
 */
export default function LivePerformanceScreen() {
  const params = useLocalSearchParams<{ demo?: string }>();
  const [demoMode, setDemoMode] = useState(params.demo === "true");
  const [sampleFps, setSampleFps] = useState(DEFAULT_SAMPLE_FPS || 2);
  const [sessionActive, setSessionActive] = useState(false);
  const [performanceId, setPerformanceId] = useState<string | null>(null);
  const [latest, setLatest] = useState<CombinedPrediction | null>(null);
  const [isStable, setIsStable] = useState(true);
  const [storySoFar, setStorySoFar] = useState<string>("");
  const [timeline, setTimeline] = useState<DetectionEvent[]>([]);
  const [modelError, setModelError] = useState<LiveErrorMessage | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [noDetection, setNoDetection] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<ReportFormat | null>(null);

  const { status, send } = useLiveDetectionSocket({
    demo: demoMode,
    performanceId: performanceId ?? undefined,
    enabled: sessionActive,
    onMessage: (message) => {
      const combined = message.data;
      setModelError(null);
      setNoDetection(null);
      setLatest(combined);
      setIsStable(message.is_stable ?? true);
      setStorySoFar(message.story_so_far);
      setTimeline((prev) => [
        ...prev,
        {
          performance_id: performanceId ?? "live_session",
          mudra_name: combined.mudra.name,
          mudra_confidence: combined.mudra.confidence,
          expression_name: combined.expression.name,
          expression_confidence: combined.expression.confidence,
          interpretation: combined.interpretation,
          timestamp: combined.mudra.timestamp,
          source: combined.mudra.source,
          model_version: combined.mudra.model_version,
          mudra_is_uncertain: combined.mudra.is_uncertain,
          expression_is_uncertain: combined.expression.is_uncertain,
          is_corrected: false,
          is_deleted: false,
        },
      ]);
    },
    onModelError: (err) => setModelError(err),
    onNoDetection: (msg) => setNoDetection(msg.message),
  });

  const cameraActive = sessionActive && !demoMode && status === "open";

  const handleFrame = useCallback(
    (base64: string, timestamp: number) => {
      send(base64, timestamp);
    },
    [send]
  );

  const startSession = async () => {
    setTimeline([]);
    setLatest(null);
    setStorySoFar("");
    setModelError(null);
    setCameraError(null);
    setNoDetection(null);
    if (!demoMode) {
      try {
        const perf = await createPerformance({
          title: `Live session ${new Date().toLocaleString()}`,
          mode: "live",
        });
        setPerformanceId(perf.id);
      } catch {
        // Continue even if session registration was skipped
      }
    }
    setSessionActive(true);
  };

  const stopSession = async () => {
    setSessionActive(false);
    if (performanceId) {
      try {
        await endPerformance(performanceId);
      } catch {
        // Ignore
      }
    }
  };

  const handleExport = async (format: ReportFormat) => {
    if (timeline.length === 0) return;
    setExportingFormat(format);
    try {
      const payload = {
        performance: {
          title: `Live Kathakali Session (${new Date().toLocaleDateString()})`,
          mode: demoMode ? "demo" : "live",
          status: "completed",
        },
        detections: timeline,
        story_events: storySoFar ? [{ text: storySoFar, timestamp: 0.0 }] : [],
      };
      const blob = await generateReport(payload, format);
      await saveOrShareBlob(blob, `kalavision_live_report.${format}`, REPORT_MIME[format]);
    } catch (e) {
      // Handle error silently or alert
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-maroon950"
      contentContainerClassName="p-5 pb-10"
      style={{ backgroundColor: "#1A0F0A" }}
      contentContainerStyle={{ maxWidth: 1000, width: "100%", alignSelf: "center" }}
    >
      <View className="flex-row justify-between items-center mb-4">
        <Badge
          label={status === "open" ? "Connected" : status === "connecting" ? "Connecting..." : "Disconnected"}
          tone={status === "open" ? "emerald" : status === "error" ? "vermilion" : "neutral"}
        />
        {demoMode ? (
          <Badge label="DEMO / MOCK MODEL" tone="gold" />
        ) : latest ? (
          <Badge
            label={overallSourceLabel(latest.mudra.source, latest.expression.source).label}
            tone={overallSourceLabel(latest.mudra.source, latest.expression.source).tone}
          />
        ) : (
          <Badge label="Real Camera Mode" tone="emerald" />
        )}
      </View>

      {!sessionActive && !demoMode ? (
        <Card className="mb-4">
          <Text className="text-ivory/50 text-xs uppercase tracking-wide mb-2">Sampling Rate</Text>
          <View className="flex-row gap-2">
            {SAMPLE_FPS_OPTIONS.map((fps) => (
              <View key={fps} {...{ onTouchEnd: () => setSampleFps(fps) }}>
                <Badge label={`${fps} fps`} tone={sampleFps === fps ? "gold" : "neutral"} />
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {cameraError ? (
        <Card className="mb-4 bg-vermilion500/10 border-vermilion500/40">
          <Text className="text-vermilion500 font-semibold mb-1">Camera error</Text>
          <Text className="text-ivory/70 text-sm">{cameraError}</Text>
        </Card>
      ) : null}

      {modelError ? (
        <Card className="mb-4 bg-vermilion500/10 border-vermilion500/40">
          <Text className="text-vermilion500 font-semibold mb-1">
            {modelError.model ?? "AI model"} unavailable
          </Text>
          <Text className="text-ivory/70 text-sm">{modelError.message}</Text>
        </Card>
      ) : null}

      {sessionActive && !demoMode && status !== "open" ? (
        <Card className="mb-4 bg-gold500/10 border-gold500/40">
          <Text className="text-gold400 font-semibold mb-1">Connecting to Vision Server...</Text>
          <Text className="text-ivory/70 text-sm">
            {status === "connecting"
              ? "Establishing WebSocket connection..."
              : "Reconnecting — frames aren't being analyzed right now."}
          </Text>
        </Card>
      ) : null}

      {sessionActive && !demoMode && noDetection ? (
        <Card className="mb-4 bg-gold500/10 border-gold500/40">
          <Text className="text-gold400 font-semibold mb-1">No Hand Detected</Text>
          <Text className="text-ivory/70 text-sm">
            {noDetection} Please hold your hand clearly in front of the camera.
          </Text>
        </Card>
      ) : null}

      {!demoMode ? (
        <View className="mb-4">
          <CameraCapture
            active={cameraActive}
            samplingFps={sampleFps}
            onFrame={handleFrame}
            onError={setCameraError}
          />
        </View>
      ) : (
        <Card className="mb-4 items-center justify-center py-10">
          <Text className="text-ivory/50 text-sm">Simulated performance — no camera feed</Text>
        </Card>
      )}

      <View className="mb-4">
        {!sessionActive ? (
          <Button label={demoMode ? "Start Demo" : "Start Live Session"} onPress={startSession} />
        ) : (
          <Button label="Stop Session" variant="secondary" onPress={stopSession} />
        )}
      </View>

      {!sessionActive ? (
        <View className="mb-4">
          <Button
            label={demoMode ? "Switch to Real Camera" : "Switch to Demo Mode"}
            variant="outline"
            onPress={() => setDemoMode((d) => !d)}
          />
        </View>
      ) : null}

      {/* Export report card when session has recorded detections */}
      {!sessionActive && timeline.length > 0 ? (
        <Card className="mb-4 bg-gold500/10 border-gold500/40">
          <Text className="text-gold400 font-semibold mb-1">Session Complete</Text>
          <Text className="text-ivory/70 text-sm mb-3">
            {timeline.length} gestures detected during this session. Export the full performance report:
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <Button
              label={exportingFormat === "pdf" ? "Exporting PDF..." : "Download PDF"}
              variant="outline"
              loading={exportingFormat === "pdf"}
              onPress={() => handleExport("pdf")}
            />
            <Button
              label={exportingFormat === "csv" ? "Exporting CSV..." : "Download CSV"}
              variant="outline"
              loading={exportingFormat === "csv"}
              onPress={() => handleExport("csv")}
            />
            <Button
              label={exportingFormat === "json" ? "Exporting JSON..." : "Download JSON"}
              variant="outline"
              loading={exportingFormat === "json"}
              onPress={() => handleExport("json")}
            />
          </View>
        </Card>
      ) : null}

      {sessionActive && latest ? (
        <View className="mb-2 self-start">
          <Badge label={isStable ? "Stable" : "Stabilizing..."} tone={isStable ? "emerald" : "gold"} />
        </View>
      ) : null}

      <MudraDetectionCard prediction={latest} />

      {storySoFar ? (
        <Card className="mt-4">
          <Text className="text-ivory/50 text-xs uppercase tracking-wide mb-1">Story So Far</Text>
          <Text className="text-ivory/90 text-sm leading-5">{storySoFar}</Text>
        </Card>
      ) : null}

      <Text className="text-ivory text-lg font-semibold mt-6 mb-3">Detection Timeline</Text>
      <DetectionTimeline events={timeline} />
    </ScrollView>
  );
}
