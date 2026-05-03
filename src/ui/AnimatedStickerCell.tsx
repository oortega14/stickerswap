import React, { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring
} from "react-native-reanimated";
import type { StickerWithStatus } from "@/domain/types";
import { colors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

const APress = Animated.createAnimatedComponent(Pressable);

export function AnimatedStickerCell({
  s,
  onTap,
  onLong,
  onInfo
}: {
  s: StickerWithStatus;
  onTap: () => void;
  onLong: () => void;
  onInfo: () => void;
}) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);
  const collected = s.count >= 1;

  useEffect(() => {
    if (s.count > 0) {
      scale.value = withSequence(
        withTiming(1.15, { duration: 100 }),
        withSpring(1.0, { damping: 8, stiffness: 200 })
      );
    }
  }, [s.count, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  return (
    <APress
      onPress={onTap}
      onLongPress={onLong}
      delayLongPress={350}
      className="flex-1 m-1"
      accessibilityLabel={`Figurita número ${s.number}, ${s.name}`}
      accessibilityRole="button"
      style={animStyle}
    >
      <View
        className="aspect-square rounded-md items-center justify-center"
        style={{
          backgroundColor: collected ? colors.purple : colors.dark,
          borderWidth: collected ? 0 : 1,
          borderColor: collected ? theme.border : theme.textMute,
          borderStyle: collected ? "solid" : "dashed"
        }}
      >
        <Text
          className="font-bold"
          style={{ color: collected ? "#fff" : colors.dim, fontSize: 12 }}
        >
          {s.number}
        </Text>
        {s.count > 1 && (
          <View
            className="absolute -bottom-1 -right-1 rounded-full items-center justify-center"
            style={{ width: 18, height: 18, backgroundColor: theme.text }}
          >
            <Text className="font-bold" style={{ fontSize: 10, color: theme.bg }}>
              {s.count}
            </Text>
          </View>
        )}
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onInfo();
          }}
          hitSlop={8}
          accessibilityLabel={`Detalle de ${s.name}`}
          className="absolute top-0.5 right-0.5"
        >
          <Text style={{ color: collected ? "#fff" : colors.dim, fontSize: 10 }}>ⓘ</Text>
        </Pressable>
      </View>
    </APress>
  );
}
