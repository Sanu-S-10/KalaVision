import { useCallback, useEffect, useRef, useState } from "react";

import { WS_URL } from "@/api/client";
import type {
  LiveDetectionMessage,
  LiveErrorMessage,
  LiveNoDetectionMessage,
  LiveSocketMessage,
} from "@/types";

export type ConnectionStatus = "idle" | "connecting" | "open" | "closed" | "error";

interface UseLiveDetectionSocketOptions {
  demo?: boolean;
  performanceId?: string;
  enabled: boolean;
  onMessage: (message: LiveDetectionMessage) => void;
  // Called when the backend reports the AI model is unavailable
  onModelError?: (message: LiveErrorMessage) => void;
  // Called when a frame was analyzed but contained nothing to classify
  onNoDetection?: (message: LiveNoDetectionMessage) => void;
}

const MAX_BACKOFF_MS = 15000;
const BASE_BACKOFF_MS = 1000;

/**
 * Connects to /api/ws/live, auto-reconnecting with exponential backoff
 * if the connection drops unexpectedly. Zero authentication required.
 */
export function useLiveDetectionSocket({
  demo = false,
  performanceId,
  enabled,
  onMessage,
  onModelError,
  onNoDetection,
}: UseLiveDetectionSocketOptions) {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const socketRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const shouldReconnectRef = useRef(true);
  const onMessageRef = useRef(onMessage);
  const onModelErrorRef = useRef(onModelError);
  onMessageRef.current = onMessage;
  onModelErrorRef.current = onModelError;
  const onNoDetectionRef = useRef(onNoDetection);
  onNoDetectionRef.current = onNoDetection;

  const connect = useCallback(() => {
    if (!enabled) return;
    setStatus("connecting");

    const params = new URLSearchParams({ demo: String(demo) });
    if (performanceId) params.set("performance_id", performanceId);

    const ws = new WebSocket(`${WS_URL}/api/ws/live?${params.toString()}`);
    socketRef.current = ws;

    ws.onopen = () => {
      attemptRef.current = 0;
      setStatus("open");
    };

    ws.onmessage = (event) => {
      try {
        const parsed: LiveSocketMessage = JSON.parse(event.data);
        if (parsed.type === "error") {
          onModelErrorRef.current?.(parsed);
        } else if (parsed.type === "no_detection") {
          onNoDetectionRef.current?.(parsed);
        } else {
          onMessageRef.current(parsed);
        }
      } catch {
        // Ignore malformed frames rather than crashing the live view.
      }
    };

    ws.onerror = () => {
      setStatus("error");
    };

    ws.onclose = () => {
      setStatus("closed");
      socketRef.current = null;
      if (shouldReconnectRef.current && enabled) {
        const delay = Math.min(BASE_BACKOFF_MS * 2 ** attemptRef.current, MAX_BACKOFF_MS);
        attemptRef.current += 1;
        setTimeout(() => {
          if (shouldReconnectRef.current) connect();
        }, delay);
      }
    };
  }, [enabled, demo, performanceId]);

  useEffect(() => {
    shouldReconnectRef.current = true;
    if (enabled) connect();
    return () => {
      shouldReconnectRef.current = false;
      socketRef.current?.close();
    };
  }, [enabled, connect]);

  const send = useCallback((imageBase64: string, timestamp: number) => {
    if (socketRef.current?.readyState === WebSocket.OPEN && !demo) {
      socketRef.current.send(JSON.stringify({ image_base64: imageBase64, timestamp }));
    }
  }, [demo]);

  return { status, send };
}
