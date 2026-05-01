import React from "react";
import { View, Text } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

type Variant = "planet" | "stars" | "rocket";

function Planet() {
  return (
    <Svg width="80" height="80" viewBox="0 0 80 80">
      <Circle cx="40" cy="40" r="22" fill="#7c5cff" opacity="0.7" />
      <Circle cx="34" cy="34" r="3" fill="#a78bfa" />
      <Circle cx="48" cy="44" r="2" fill="#a78bfa" />
      <Path d="M 12 40 Q 40 28 68 40 Q 40 52 12 40 Z" fill="none" stroke="#3b82f6" strokeWidth="1.5" opacity="0.6" />
    </Svg>
  );
}

function Stars() {
  return (
    <Svg width="80" height="80" viewBox="0 0 80 80">
      <Circle cx="20" cy="20" r="2" fill="#fff" />
      <Circle cx="60" cy="30" r="1.5" fill="#fff" opacity="0.7" />
      <Circle cx="40" cy="55" r="2.5" fill="#a78bfa" />
      <Circle cx="65" cy="60" r="1.2" fill="#fff" opacity="0.6" />
      <Circle cx="15" cy="60" r="1.8" fill="#fff" opacity="0.8" />
    </Svg>
  );
}

function Rocket() {
  return (
    <Svg width="80" height="80" viewBox="0 0 80 80">
      <Path d="M 40 10 L 50 40 L 40 60 L 30 40 Z" fill="#7c5cff" />
      <Circle cx="40" cy="32" r="4" fill="#fff" />
      <Path d="M 35 60 L 30 70 L 40 65 L 50 70 L 45 60 Z" fill="#3b82f6" />
    </Svg>
  );
}

export function EmptyState({
  variant,
  title,
  message
}: {
  variant: Variant;
  title: string;
  message?: string;
}) {
  return (
    <View className="items-center justify-center py-12 px-6">
      {variant === "planet" && <Planet />}
      {variant === "stars" && <Stars />}
      {variant === "rocket" && <Rocket />}
      <Text className="text-space-ink font-semibold mt-4 text-center">{title}</Text>
      {message && <Text className="text-space-mute text-sm mt-1 text-center">{message}</Text>}
    </View>
  );
}
