import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";

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
import { sourceLabel } from "@/utils/modelSource";
import type { DetectionEvent, LandmarkPoint, LiveDetectionPayload, LiveErrorMessage, ReportFormat } from "@/types";

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
 *     -> 21 3D Hand Landmarks extracted & sent back
 *     -> Real-time Hand Skeleton Overlay rendered on camera image
 *     -> confidence filtering -> temporal smoothing
 *     -> Detection Event back over WebSocket
 *     -> UI (HandSkeletonOverlay, MudraDetectionCard, DetectionTimeline, Report Export)
 */
export default function LivePerformanceScreen() {
  const params = useLocalSearchParams<{ demo?: string }>();
  const [demoMode, setDemoMode] = useState(params.demo === "true");
  const [sampleFps, setSampleFps] = useState(DEFAULT_SAMPLE_FPS || 2);
  const [sessionActive, setSessionActive] = useState(false);
  const [performanceId, setPerformanceId] = useState<string | null>(null);
  const [latest, setLatest] = useState<LiveDetectionPayload | null>(null);
  const [landmarks, setLandmarks] = useState<LandmarkPoint[] | null>(null);
  const [allHands, setAllHands] = useState<LandmarkPoint[][] | null>(null);
  const [handDetected, setHandDetected] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"front" | "back">("front");
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
      const payload = message.data;
      setModelError(null);
      setNoDetection(null);
      setLatest(payload);
      const isDetected = payload.hand_detected ?? payload.mudra.hand_detected ?? true;
      setHandDetected(isDetected);
      setLandmarks(payload.landmarks ?? payload.mudra.landmarks ?? null);
      setAllHands(payload.all_hands ?? payload.mudra.all_hands ?? null);
      setIsStable(message.is_stable ?? true);
      setStorySoFar(message.story_so_far);

      setTimeline((prev) => [
        ...prev,
        {
          performance_id: performanceId ?? "live_session",
          mudra_name: payload.mudra.name,
          mudra_confidence: payload.mudra.confidence,
          interpretation: payload.interpretation,
          timestamp: payload.mudra.timestamp,
          source: payload.mudra.source,
          model_version: payload.mudra.model_version,
          mudra_is_uncertain: payload.mudra.is_uncertain,
          hand_detected: isDetected,
          landmarks: payload.landmarks ?? payload.mudra.landmarks,
          is_corrected: false,
          is_deleted: false,
        },
      ]);
    },
    onModelError: (err) => setModelError(err),
    onNoDetection: (msg) => {
      setNoDetection(msg.message || "Hand not detected — position your hand inside the frame.");
      setHandDetected(false);
      setLandmarks(null);
      setAllHands(null);
    },
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
    setLandmarks(null);
    setAllHands(null);
    setHandDetected(false);
    setStorySoFar("");
    setModelError(null);
    setCameraError(null);
    setNoDetection(null);
    if (!demoMode) {
      try {
        const perf = await createPerformance({
          title: `Live Kathakali Session ${new Date().toLocaleDateString()}`,
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
    setHandDetected(false);
    setLandmarks(null);
    setAllHands(null);
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
    } catch {
      // Handle error silently
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
          <Badge label="DEMO MODE (SYNTHETIC)" tone="gold" />
        ) : latest ? (
          <Badge
            label={sourceLabel(latest.mudra.source).label}
            tone={sourceLabel(latest.mudra.source).tone}
          />
        ) : (
          <Badge label="REAL CAMERA AI MODE" tone="emerald" />
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
            {noDetection}
          </Text>
        </Card>
      ) : null}

      {/* Primary Focus: Live Camera Feed with Hand Skeleton Overlay */}
      {!demoMode ? (
        <View className="mb-4">
          <CameraCapture
            active={cameraActive}
            samplingFps={sampleFps}
            onFrame={handleFrame}
            onError={setCameraError}
            landmarks={landmarks}
            allHands={allHands}
            handDetected={handDetected}
            facing={cameraFacing}
            onToggleFacing={() => setCameraFacing((f) => (f === "front" ? "back" : "front"))}
          />
        </View>
      ) : (
        <Card className="mb-4 items-center justify-center py-10">
          <Text className="text-gold400 font-medium text-base mb-1">Demo Mode Active</Text>
          <Text className="text-ivory/60 text-xs text-center max-w-xs">
            Synthesizing canonical Kathakali mudras, 21-point hand skeletons, confidences, and story beats.
          </Text>
        </Card>
      )}

      {/* Start / Pause / Stop controls */}
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
            label={demoMode ? "Switch to Real Camera Mode" : "Switch to Demo Mode"}
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
            {timeline.length} Kathakali mudras detected. Export the performance report:
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
          <Badge label={isStable ? "Stable Mudra" : "Stabilizing..."} tone={isStable ? "emerald" : "gold"} />
        </View>
      ) : null}

      <MudraDetectionCard prediction={latest} />

      {storySoFar ? (
        <Card className="mt-4">
          <Text className="text-ivory/50 text-xs uppercase tracking-wide mb-1">Cultural Narrative So Far</Text>
          <Text className="text-ivory/90 text-sm leading-5">{storySoFar}</Text>
        </Card>
      ) : null}

      <Text className="text-ivory text-lg font-semibold mt-6 mb-3">
        Mudra Detection Timeline ({timeline.length})
      </Text>
      <DetectionTimeline events={timeline} />
    </ScrollView>
  );
}

