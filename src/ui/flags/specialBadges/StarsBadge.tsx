import React from "react";
import { Svg, Rect, Text as SvgText } from "react-native-svg";

interface Props { size?: number | string }

export function StarsBadge({ size = "100%" }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect width="100" height="100" fill="#7c3aed" />
      <SvgText
        x="50"
        y="62"
        textAnchor="middle"
        fill="#fff"
        fontWeight="800"
        fontSize="48"
      >
        ★
      </SvgText>
    </Svg>
  );
}
