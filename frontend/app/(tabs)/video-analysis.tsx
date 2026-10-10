import * as DocumentPicker from "expo-document-picker";
import { Download, FileSpreadsheet, FileText } from "lucide-react-native";
import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { describeApiError } from "@/api/client";
import { analyzeVideo, createPerformance } from "@/api/performances";
import { exportReport } from "@/api/reports";
import { DetectionTimeline } from "@/components/DetectionTimeline";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { saveOrShareBlob } from "@/utils/exportFile";
import type { DetectionEvent, Performance, ReportFormat } from "@/types";

type Stage = "idle" | "uploading" | "processing" | "completed" | "failed";

const SAMPLE_FPS_OPTIONS = [1, 2, 5];

const REPORT_MIME: Record<ReportFormat, string> = {
  json: "application/json",
  csv: "text/csv",
  pdf: "application/pdf",
};

/**
 * Video Analysis screen — upload a recorded performance and run it
 * through the full pipeline: validate -> extract/sample frames -> mudra
 * detection via real Random Forest classifier -> confidence filter ->
 * temporal smoothing -> story interpretation -> direct report export.
 */
export default function VideoAnalysisScreen() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("video/mp4");
  const [sampleFps, setSampleFps] = useState(2);
  const [stage, setStage] = useState<Stage>("idle");
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [detections, setDetections] = useState<DetectionEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<ReportFormat | null>(null);

  const pickVideo = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: "video/*" });
    if (result.canceled) return;
    const asset = result.assets[0];
    setFileName(asset.name);
    setFileUri(asset.uri);
    setMimeType(asset.mimeType ?? "video/mp4");
    setError(null);
    setStage("idle");
    setDetections([]);
    setPerformance(null);
  };

  const runAnalysis = async () => {
    if (!fileUri || !fileName) return;
    setError(null);

    try {
      setStage("uploading");
      const perf = await createPerformance({ title: fileName, mode: "video" });
      setPerformance(perf);

      setStage("processing");
      const results = await analyzeVideo(perf.id, fileUri, fileName, mimeType, sampleFps);
      setDetections(results);
      setStage("completed");
    } catch (e) {
      setError(describeApiError(e));
      setStage("failed");
    }
  };

  const handleExport = async (format: ReportFormat) => {
    if (!performance) return;
    setExportingFormat(format);
    setError(null);
    try {
      const blob = await exportReport(performance.id, format);
      await saveOrShareBlob(
        blob,
        `kalavision_report_${performance.id}.${format}`,
        REPORT_MIME[format]
      );
    } catch (e) {
      setError(describeApiError(e));
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
      <Text className="text-ivory text-xl font-bold mb-1">Video Analysis</Text>
      <Text className="text-ivory/60 text-sm mb-5">
        Upload a recorded performance to run mudra and expression detection on it.
      </Text>

      <Card className="items-center py-8 mb-4">
        {fileName ? (
          <Text className="text-ivory font-medium mb-1">{fileName}</Text>
        ) : (
          <Text className="text-ivory/50 text-sm mb-3">No video selected</Text>
        )}
        <View className="mt-4">
          <Button label="Choose video" onPress={pickVideo} variant="outline" />
        </View>
      </Card>

      {fileName && stage === "idle" ? (
        <Card className="mb-4">
          <Text className="text-ivory/50 text-xs uppercase tracking-wide mb-2">
            Frame sampling rate
          </Text>
          <Text className="text-ivory/60 text-xs mb-3">
            How many frames per second to run detection on — lower is faster for long recordings.
          </Text>
          <View className="flex-row gap-2 mb-4">
            {SAMPLE_FPS_OPTIONS.map((fps) => (
              <View key={fps} {...{ onTouchEnd: () => setSampleFps(fps) }}>
                <Badge label={`${fps} fps`} tone={sampleFps === fps ? "gold" : "neutral"} />
              </View>
            ))}
          </View>
          <Button label="Start analysis" onPress={runAnalysis} />
        </Card>
      ) : null}

      {stage === "uploading" ? (
        <Card className="mb-4 items-center py-6">
          <Badge label="Uploading video..." tone="gold" />
        </Card>
      ) : null}

      {stage === "processing" ? (
        <Card className="mb-4 items-center py-6">
          <Badge label="Processing video..." tone="gold" />
          <Text className="text-ivory/50 text-xs text-center mt-2">
            Extracting frames, running real mudra detection, temporal smoothing, and building the story...
          </Text>
        </Card>
      ) : null}

      {stage === "failed" && error ? (
        <Card className="mb-4 bg-vermilion500/10 border-vermilion500/40">
          <Text className="text-vermilion500 font-semibold mb-1">Analysis failed</Text>
          <Text className="text-ivory/70 text-sm">{error}</Text>
        </Card>
      ) : null}

      {stage === "completed" && performance ? (
        <>
          <Card className="mb-4 bg-emerald500/10 border-emerald500/40">
            <Text className="text-emerald500 font-semibold mb-1">Analysis complete</Text>
            <Text className="text-ivory/70 text-sm mb-3">
              {detections.length} gesture detections identified in {performance.title}.
            </Text>

            <Text className="text-ivory/60 text-xs mb-2">Export Performance Report:</Text>
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

          <Text className="text-ivory text-lg font-semibold mb-3">
            Scene Detection Timeline ({detections.length} events)
          </Text>
          <DetectionTimeline events={detections} />
        </>
      ) : null}

      {stage === "idle" && !fileName ? (
        <EmptyState
          title="Nothing analyzed yet"
          description="Pick a video file above to start — supported formats: mp4, mov, avi, webm."
        />
      ) : null}
    </ScrollView>
  );
}
