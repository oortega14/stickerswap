import React from "react";
import { Svg, Rect, Path } from "react-native-svg";

interface Props { size?: number | string }

export function ExtrasBadge({ size = "100%" }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect width="100" height="100" fill="#1e3a8a" />
      {/* Estrella dorada */}
      <Path
        d="M50 20 L58 42 L82 42 L62 56 L70 78 L50 64 L30 78 L38 56 L18 42 L42 42 Z"
        fill="#fbbf24"
        stroke="#92400e"
        strokeWidth="1"
      />
    </Svg>
  );
}
