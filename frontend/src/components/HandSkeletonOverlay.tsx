import React, { useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";

import type { LandmarkPoint } from "@/types";

export const HAND_CONNECTIONS: [number, number][] = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index finger
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle finger
  [9, 10], [10, 11], [11, 12],
  // Ring finger
  [13, 14], [14, 15], [15, 16],
  // Pinky finger
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm connections (metacarpals)
  [5, 9], [9, 13], [13, 17],
];

const FINGERTIP_INDICES = new Set([4, 8, 12, 16, 20]);

export interface HandSkeletonOverlayProps {
  landmarks?: LandmarkPoint[] | null;
  allHands?: LandmarkPoint[][] | null;
  handDetected?: boolean;
  isMirrored?: boolean;
  active?: boolean;
}

export function HandSkeletonOverlay({
  landmarks,
  allHands,
  handDetected = false,
  isMirrored = false,
  active = true,
}: HandSkeletonOverlayProps) {
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setDimensions({ width, height });
    }
  };

  const { width, height } = dimensions;

  // Determine hands to render without mixing landmarks
  const handsToRender: LandmarkPoint[][] = [];
  if (allHands && allHands.length > 0) {
    for (const hand of allHands) {
      if (hand && hand.length === 21) {
        handsToRender.push(hand);
      }
    }
  } else if (landmarks && landmarks.length === 21) {
    handsToRender.push(landmarks);
  }

  const hasHands = handDetected && handsToRender.length > 0;

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none">
      {hasHands && width > 0 && height > 0 ? (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          {handsToRender.map((hand, handIdx) => {
            const strokeColor = handIdx === 0 ? "#10B981" : "#3B82F6"; // Emerald for Hand 1, Blue for Hand 2
            const jointColor = handIdx === 0 ? "#D4A033" : "#60A5FA";

            return (
              <React.Fragment key={`hand-${handIdx}`}>
                {/* Connecting lines between landmarks */}
                {HAND_CONNECTIONS.map(([startIdx, endIdx], edgeIdx) => {
                  const p1 = hand[startIdx];
                  const p2 = hand[endIdx];
                  if (!p1 || !p2) return null;

                  const x1 = (isMirrored ? 1 - p1.x : p1.x) * width;
                  const y1 = p1.y * height;
                  const x2 = (isMirrored ? 1 - p2.x : p2.x) * width;
                  const y2 = p2.y * height;

                  return (
                    <Line
                      key={`edge-${handIdx}-${edgeIdx}`}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={strokeColor}
                      strokeWidth={handIdx === 0 ? "3" : "2.5"}
                      strokeLinecap="round"
                      strokeOpacity={0.9}
                    />
                  );
                })}

                {/* 21 landmark nodes */}
                {hand.map((lm, nodeIdx) => {
                  const cx = (isMirrored ? 1 - lm.x : lm.x) * width;
                  const cy = lm.y * height;
                  const isFingertip = FINGERTIP_INDICES.has(nodeIdx);
                  const isWrist = nodeIdx === 0;

                  const radius = isWrist ? 6 : isFingertip ? 5 : 4;
                  const fillColor = isWrist ? "#D4A033" : isFingertip ? "#F59E0B" : "#FDFBF7";

                  return (
                    <Circle
                      key={`node-${handIdx}-${nodeIdx}`}
                      cx={cx}
                      cy={cy}
                      r={radius}
                      fill={fillColor}
                      stroke={jointColor}
                      strokeWidth={isFingertip ? "2.5" : "1.5"}
                    />
                  );
                })}
              </React.Fragment>
            );
          })}
        </Svg>
      ) : null}

      {/* Subtle indicator when hand is not detected */}
      {active && !hasHands ? (
        <View style={styles.noHandBanner}>
          <Text style={styles.noHandText}>
            Hand not detected — position your hand inside the frame
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  noHandBanner: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: "rgba(26, 15, 10, 0.82)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(212, 160, 51, 0.35)",
    alignItems: "center",
  },
  noHandText: {
    color: "#E2D9D2",
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
});
