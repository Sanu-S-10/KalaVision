import React, { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

import { Badge } from "./ui/Badge";
import { Card } from "./ui/Card";
import type { CameraCaptureProps } from "./CameraCapture";

type WebCameraState = "idle" | "requesting" | "ready" | "denied" | "unavailable" | "error";

/**
 * Web camera capture — Metro/webpack picks this file automatically on
 * web builds (same component name, `.web.tsx` extension) instead of
 * CameraCapture.tsx. expo-camera's native CameraView is not used here:
 * the browser's own getUserMedia + <video>/<canvas> is the standard,
 * reliable way to grab frames on web, and behaves differently enough
 * from the native camera APIs (permission model, no takePictureAsync
 * equivalent) that sharing one implementation across platforms would be
 * the wrong call — this mirrors the explicit platform split requested
 * for Android vs. Web camera handling.
 */
export function CameraCapture({ active, samplingFps, onFrame, onError }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isCapturingRef = useRef(false);
  const startTimeRef = useRef<number | null>(null);
  const [state, setState] = useState<WebCameraState>("idle");

  // Acquire/release the browser camera stream whenever this screen is on
  // screen, independent of `active` (so the preview can show before the
  // user presses Start, same as the native camera preview does).
  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setState("unavailable");
        onError?.("This browser doesn't support camera access.");
        return;
      }
      setState("requesting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
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
  }, []);

  // Frame capture loop — draws the live <video> to an offscreen <canvas>
  // and reads it back as base64 JPEG, at the configured sampling rate.
  useEffect(() => {
    if (!active) {
      startTimeRef.current = null;
      return;
    }
    if (state !== "ready") return;

    startTimeRef.current = Date.now();
    const intervalMs = Math.max(100, Math.round(1000 / samplingFps));

    const interval = setInterval(() => {
      if (isCapturingRef.current) return; // skip a tick rather than queue up
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
        style: { width: "100%", height: "100%", objectFit: "cover" },
      })}
      {React.createElement("canvas", { ref: canvasRef, style: { display: "none" } })}
      {active && state === "ready" ? (
        <View className="absolute top-2 right-2">
          <Badge label={`${samplingFps} fps`} tone="gold" />
        </View>
      ) : null}
    </Card>
  );
}
