import { CameraType, CameraView, useCameraPermissions } from "expo-camera";
import React, { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

export interface CameraCaptureProps {
  /** Whether the capture loop should be running. Toggling this false
   * stops the interval and resets the elapsed-time clock, so a new
   * session starts timestamps back at 0. */
  active: boolean;
  /** Frames captured per second — configurable (see live.tsx, which reads
   * EXPO_PUBLIC_LIVE_SAMPLE_FPS and lets the user override it). Kept low
   * by default on purpose: capturing/encoding every camera frame would
   * both waste bandwidth and risk queueing captures faster than the
   * backend (or the network) can keep up with. */
  samplingFps: number;
  /** Called with a raw base64 JPEG (no data: prefix) and a timestamp in
   * seconds since this capture session became active. */
  onFrame: (base64: string, timestampSeconds: number) => void;
  onError?: (message: string) => void;
}

/**
 * Native (Android/iOS) camera capture — this file is picked by Metro's
 * platform resolution for any platform OTHER than web; see
 * CameraCapture.web.tsx for the browser implementation. Capture happens
 * via expo-camera's CameraView.takePictureAsync on an interval, guarded
 * so a slow capture never overlaps the next tick (keeping the UI thread
 * free rather than queueing up a backlog of frames).
 */
export function CameraCapture({ active, samplingFps, onFrame, onError }: CameraCaptureProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const isCapturingRef = useRef(false);
  const startTimeRef = useRef<number | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    if (!active) {
      startTimeRef.current = null;
      return;
    }
    if (!permission?.granted || !cameraReady) return;

    startTimeRef.current = Date.now();
    const intervalMs = Math.max(100, Math.round(1000 / samplingFps));

    const interval = setInterval(async () => {
      if (isCapturingRef.current || !cameraRef.current) return; // skip a tick rather than queue up
      isCapturingRef.current = true;
      try {
        const result = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.4,
          skipProcessing: true,
        });
        if (result?.base64 && startTimeRef.current != null) {
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          onFrame(result.base64, elapsed);
        }
      } catch (err) {
        onError?.(err instanceof Error ? err.message : "Camera frame capture failed.");
      } finally {
        isCapturingRef.current = false;
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [active, samplingFps, permission?.granted, cameraReady, onFrame, onError]);

  if (!permission) {
    return (
      <Card className="items-center justify-center py-10">
        <Text className="text-ivory/60 text-sm">Checking camera permission...</Text>
      </Card>
    );
  }

  if (!permission.granted) {
    return (
      <Card className="items-center justify-center py-10">
        <Text className="text-ivory font-semibold mb-2">Camera permission denied</Text>
        <Text className="text-ivory/60 text-sm text-center mb-4">
          KalaVision AI needs camera access to detect mudras and expressions live.
        </Text>
        <Button label="Grant permission" onPress={requestPermission} />
      </Card>
    );
  }

  return (
    <Card className="p-0 overflow-hidden aspect-[3/4]">
      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing={"front" as CameraType}
        onCameraReady={() => setCameraReady(true)}
      />
      {active ? (
        <View className="absolute top-2 right-2">
          <Badge label={`${samplingFps} fps`} tone="gold" />
        </View>
      ) : null}
    </Card>
  );
}
