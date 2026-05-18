import React from "react";
import { Svg, Defs, LinearGradient, Stop, Rect, Path } from "react-native-svg";

interface Props { size?: number | string }

export function IntroBadge({ size = "100%" }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="introBg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#fef3c7" />
          <Stop offset="1" stopColor="#f59e0b" />
        </LinearGradient>
      </Defs>
      <Rect width="100" height="100" fill="url(#introBg)" />
      {/* Trofeo simplificado */}
      <Path
        d="M30 25 L70 25 L65 55 Q50 65 35 55 Z"
        fill="#92400e"
      />
      <Rect x="44" y="62" width="12" height="10" fill="#92400e" />
      <Rect x="38" y="72" width="24" height="6" fill="#78350f" />
    </Svg>
  );
}
