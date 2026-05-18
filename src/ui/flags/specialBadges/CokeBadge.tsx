import React from "react";
import { Svg, Rect, Text as SvgText } from "react-native-svg";

interface Props { size?: number | string }

export function CokeBadge({ size = "100%" }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect width="100" height="100" fill="#e60026" />
      <SvgText
        x="50"
        y="60"
        textAnchor="middle"
        fill="#fff"
        fontWeight="700"
        fontStyle="italic"
        fontSize="16"
      >
        Coca-Cola
      </SvgText>
    </Svg>
  );
}
