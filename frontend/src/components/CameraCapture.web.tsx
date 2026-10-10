import { FlipHorizontal } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { HandSkeletonOverlay } from "./HandSkeletonOverlay";
import { Badge } from "./ui/Badge";
import { Card } from "./ui/Card";
import type { CameraCaptureProps } from "./CameraCapture";

type WebCameraState = "idle" | "requesting" | "ready" | "denied" | "unavailable" | "error";

/**
 * Web camera capture with real-time Hand Skeleton Overlay.
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isCapturingRef = useRef(false);
  const startTimeRef = useRef<number | null>(null);
  const [state, setState] = useState<WebCameraState>("idle");
  const [internalFacing, setInternalFacing] = useState<"front" | "back">(
    initialFacing === "back" ? "back" : "front"
  );

  const facing = onToggleFacing ? (initialFacing === "back" ? "back" : "front") : internalFacing;
  const isFront = facing === "front";

  const toggleCameraFacing = () => {
    if (onToggleFacing) {
      onToggleFacing();
    } else {
      setInternalFacing((cur) => (cur === "front" ? "back" : "front"));
    }
  };

  // Acquire/release the browser camera stream
  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setState("unavailable");
        onError?.("This browser doesn't support camera access.");
        return;
      }

      // Stop existing stream if switching facing mode
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      setState("requesting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: isFront ? "user" : "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setState("ready");
      } catch (err: any) {
        if (cancelled) return;
        if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
          setState("denied");
          onError?.("Browser camera permission denied.");
        } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
          setState("unavailable");
          onError?.("No camera device found.");
        } else {
          setState("error");
          onError?.(err instanceof Error ? err.message : "Camera initialization failed.");
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFront]);

  // Frame capture loop — draws the live <video> to an offscreen <canvas>
  useEffect(() => {
    if (!active) {
      startTimeRef.current = null;
      return;
    }
    if (state !== "ready") return;

    startTimeRef.current = Date.now();
    const intervalMs = Math.max(100, Math.round(1000 / samplingFps));

    const interval = setInterval(() => {
      if (isCapturingRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.videoWidth === 0) return;

      isCapturingRef.current = true;
      try {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.5);
        const base64 = dataUrl.split(",")[1];
        if (base64 && startTimeRef.current != null) {
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          onFrame(base64, elapsed);
        }
      } catch (err) {
        onError?.(err instanceof Error ? err.message : "Camera frame capture failed.");
      } finally {
        isCapturingRef.current = false;
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [active, samplingFps, state, onFrame, onError]);

  if (state === "denied") {
    return (
      <Card className="items-center justify-center py-10">
        <Text className="text-ivory font-semibold mb-2">Browser camera permission denied</Text>
        <Text className="text-ivory/60 text-sm text-center">
          Allow camera access in your browser's address-bar permissions, then reload the page.
        </Text>
      </Card>
    );
  }

  if (state === "unavailable") {
    return (
      <Card className="items-center justify-center py-10">
        <Text className="text-ivory font-semibold mb-2">Camera unavailable</Text>
        <Text className="text-ivory/60 text-sm text-center">
          No camera device was found on this computer.
        </Text>
      </Card>
    );
  }

  if (state === "error") {
    return (
      <Card className="items-center justify-center py-10">
        <Text className="text-ivory font-semibold mb-2">Camera initialization failed</Text>
        <Text className="text-ivory/60 text-sm text-center">
          Something went wrong starting the browser camera. Reloading the page sometimes helps.
        </Text>
      </Card>
    );
  }

  return (
    <Card className="p-0 overflow-hidden aspect-[3/4] relative">
      {state === "requesting" ? (
        <View className="absolute inset-0 items-center justify-center z-10">
          <Text className="text-ivory/60 text-sm">Requesting camera access...</Text>
        </View>
      ) : null}

      {React.createElement("video", {
        ref: videoRef,
        autoPlay: true,
        muted: true,
        playsInline: true,
        style: {
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: isFront ? "scaleX(-1)" : "none",
        },
      })}

      {React.createElement("canvas", { ref: canvasRef, style: { display: "none" } })}

      {/* Hand Skeleton Overlay */}
      <HandSkeletonOverlay
        landmarks={landmarks}
        allHands={allHands}
        handDetected={handDetected}
        isMirrored={isFront}
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

      {active && state === "ready" ? (
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

