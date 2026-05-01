import React from "react";
import { View, Dimensions } from "react-native";
import Animated, {
  SharedValue,
  useAnimatedStyle
} from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Stop, Rect } from "react-native-svg";

const { width, height } = Dimensions.get("window");

const STARS = Array.from({ length: 60 }, (_, i) => {
  const x = (i * 1373 + 7) % width;
  const y = (i * 919 + 31) % height;
  const r = ((i * 17) % 3) * 0.4 + 0.5;
  const opacity = 0.3 + ((i * 13) % 70) / 100;
  return { x, y, r, opacity };
});

export function StarryBackground({
  children,
  parallaxScrollY
}: {
  children?: React.ReactNode;
  parallaxScrollY?: SharedValue<number>;
}) {
  const animStyle = useAnimatedStyle(() => {
    if (!parallaxScrollY) return {};
    return {
      transform: [{ translateY: -(parallaxScrollY.value * 0.08) }]
    };
  });

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <Animated.View
        style={[{ position: "absolute", top: 0, left: 0 }, animStyle]}
        pointerEvents="none"
      >
        <Svg width={width} height={height}>
          <Defs>
            <RadialGradient id="nebula" cx="30%" cy="20%" r="80%">
              <Stop offset="0%" stopColor="#5b1ea3" stopOpacity="0.6" />
              <Stop offset="40%" stopColor="#1a0d4d" stopOpacity="0.8" />
              <Stop offset="100%" stopColor="#000000" stopOpacity="1" />
            </RadialGradient>
          </Defs>
          <Rect width={width} height={height} fill="url(#nebula)" />
          {STARS.map((s, i) => (
            <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#ffffff" opacity={s.opacity} />
          ))}
        </Svg>
      </Animated.View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
