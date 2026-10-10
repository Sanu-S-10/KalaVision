import { CameraType, CameraView, useCameraPermissions } from "expo-camera";
import { FlipHorizontal } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { HandSkeletonOverlay } from "./HandSkeletonOverlay";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import type { LandmarkPoint } from "@/types";

export interface CameraCaptureProps {
  /** Whether the capture loop should be running. */
  active: boolean;
  /** Frames captured per second. */
  samplingFps: number;
  /** Called with a raw base64 JPEG and timestamp in seconds. */
  onFrame: (base64: string, timestampSeconds: number) => void;
  onError?: (message: string) => void;
  landmarks?: LandmarkPoint[] | null;
  allHands?: LandmarkPoint[][] | null;
  handDetected?: boolean;
  facing?: CameraType;
  onToggleFacing?: () => void;
}

/**
 * Native (Android/iOS) camera capture with real-time Hand Skeleton Overlay.
 */
export function CameraCapture({
  active,
  samplingFps,
  onFrame,
  onError,
  landmarks,
  allHands,
  handDetected = false,
  facing: initialFacing = "front",
  onToggleFacing,
}: CameraCaptureProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [internalFacing, setInternalFacing] = useState<CameraType>(initialFacing);
  const cameraRef = useRef<CameraView>(null);
  const isCapturingRef = useRef(false);
  const startTimeRef = useRef<number | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const facing = onToggleFacing ? initialFacing : internalFacing;
  const toggleCameraFacing = () => {
    if (onToggleFacing) {
      onToggleFacing();
    } else {
      setInternalFacing((cur) => (cur === "front" ? "back" : "front"));
    }
  };

  useEffect(() => {
    if (!active) {
      startTimeRef.current = null;
      return;
    }
    if (!permission?.granted || !cameraReady) return;

    startTimeRef.current = Date.now();
    const intervalMs = Math.max(100, Math.round(1000 / samplingFps));

    const interval = setInterval(async () => {
      if (isCapturingRef.current || !cameraRef.current) return;
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
          KalaVision AI needs camera access to detect Kathakali mudras live.
        </Text>
        <Button label="Grant permission" onPress={requestPermission} />
      </Card>
    );
  }

  return (
    <Card className="p-0 overflow-hidden aspect-[3/4] relative">
      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing={facing}
        onCameraReady={() => setCameraReady(true)}
      />

      {/* Hand Skeleton Overlay */}
      <HandSkeletonOverlay
        landmarks={landmarks}
        allHands={allHands}
        handDetected={handDetected}
        isMirrored={facing === "front"}
        active={active}
      />

      {/* Flip camera button */}
      <TouchableOpacity
        onPress={toggleCameraFacing}
        activeOpacity={0.7}
        style={styles.flipButton}
      >
        <FlipHorizontal color="#D4A033" size={18} />
      </TouchableOpacity>

      {active ? (
        <View className="absolute top-2 right-2">
          <Badge label={`${samplingFps} fps`} tone="gold" />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flipButton: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(26, 15, 10, 0.75)",
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(212, 160, 51, 0.3)",
    zIndex: 20,
  },
});

