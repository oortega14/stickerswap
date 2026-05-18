import React, { useCallback } from "react";
import { View, Pressable, Text } from "react-native";
import { FlagSvg } from "@/ui/flags/FlagSvg";
import { haptics } from "@/lib/haptics";
import { useIncrement, useDecrement } from "@/hooks/useStickers";
import type { StickerWithStatus } from "@/domain/types";

interface Props {
  sticker: StickerWithStatus;
  teamCode: string | null;
}

export function StickerBolita({ sticker, teamCode }: Props) {
  const inc = useIncrement();
  const dec = useDecrement();

  const handlePress = useCallback(() => {
    haptics.light();
    inc.mutate(sticker.code);
  }, [sticker.code, inc]);

  const handleLongPress = useCallback(() => {
    if (sticker.count === 0) return;
    haptics.medium();
    dec.mutate(sticker.code);
  }, [sticker.code, sticker.count, dec]);

  const isMissing = sticker.count === 0;
  const hasDups = sticker.count > 1;

  return (
    <View style={{ width: "20%", padding: 4 }}>
      <View style={{ position: "relative", aspectRatio: 1 }}>
        <Pressable
          onPress={handlePress}
          onLongPress={handleLongPress}
          delayLongPress={350}
          accessibilityRole="button"
          accessibilityLabel={`${sticker.name}, ${
            isMissing ? "falta" : hasDups ? `repetida ${sticker.count}` : "pegada"
          }`}
          accessibilityHint="Toca para sumar, manten para restar"
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 9999,
            overflow: "hidden",
            borderWidth: 2,
            borderColor: "rgba(0,0,0,0.1)"
          }}
        >
          <FlagSvg code={teamCode} section={sticker.section} />
          {isMissing && (
            <View
              style={{
                position: "absolute",
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: "rgba(120, 113, 108, 0.55)"
              }}
              pointerEvents="none"
            />
          )}
          <View
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: [{ translateX: -22 }, { translateY: -9 }],
              backgroundColor: "#fff",
              borderRadius: 999,
              paddingHorizontal: 6,
              paddingVertical: 2,
              minWidth: 44,
              alignItems: "center"
            }}
          >
            <Text style={{ fontSize: 9, fontWeight: "800", color: "#1c1917" }}>
              {sticker.code}
            </Text>
          </View>
        </Pressable>
        {hasDups && (
          <View
            style={{
              position: "absolute",
              top: -3,
              right: -3,
              backgroundColor: "#ea580c",
              borderRadius: 999,
              paddingHorizontal: 5,
              paddingVertical: 1,
              borderWidth: 2,
              borderColor: "#fff",
              zIndex: 2
            }}
          >
            <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>
              ×{sticker.count}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
