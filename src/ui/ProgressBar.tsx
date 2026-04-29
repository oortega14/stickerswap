import React from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";

export function ProgressBar({ pct, height = 8 }: { pct: number; height?: number }) {
  const clamped = Math.max(0, Math.min(1, pct));
  return (
    <View style={{ height, width: "100%" }}>
      <Svg width="100%" height={height}>
        <Defs>
          <LinearGradient id="pb" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#7c5cff" />
            <Stop offset="1" stopColor="#3b82f6" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height={height} rx={height / 2} fill="#0f0d24" />
        <Rect
          width={`${clamped * 100}%`}
          height={height}
          rx={height / 2}
          fill="url(#pb)"
        />
      </Svg>
    </View>
  );
}
