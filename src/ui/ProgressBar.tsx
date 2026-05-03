import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";

const ARect = Animated.createAnimatedComponent(Rect);

export function ProgressBar({
  pct,
  height = 8,
  from = "#7c5cff",
  to = "#3b82f6"
}: {
  pct: number;
  height?: number;
  from?: string;
  to?: string;
}) {
  const clamped = Math.max(0, Math.min(1, pct));
  const w = useSharedValue(clamped);

  useEffect(() => {
    w.value = withTiming(clamped, { duration: 600 });
  }, [clamped, w]);

  const props = useAnimatedProps(() => ({
    width: `${w.value * 100}%` as unknown as number
  }));

  return (
    <View style={{ height, width: "100%" }}>
      <Svg width="100%" height={height}>
        <Defs>
          <LinearGradient id="pb" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height={height} rx={height / 2} fill="#0f0d24" />
        <ARect
          animatedProps={props}
          height={height}
          rx={height / 2}
          fill="url(#pb)"
        />
      </Svg>
    </View>
  );
}
