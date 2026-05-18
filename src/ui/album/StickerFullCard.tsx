import React, { useCallback } from "react";
import { View, Pressable, Text, Image } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { haptics } from "@/lib/haptics";
import { useIncrement, useDecrement } from "@/hooks/useStickers";
import { getInitials } from "@/domain/playerInitials";
import { getTeamColors } from "@/theme/teamColors";
import type { StickerWithStatus } from "@/domain/types";

interface Props {
  sticker: StickerWithStatus;
  teamCode: string | null;
}

export function StickerFullCard({ sticker, teamCode }: Props) {
  const { theme } = useTheme();
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
  const teamColors = teamCode ? getTeamColors(teamCode) : null;
  const photoBg = teamColors?.bg ?? theme.accent;

  return (
    <View style={{ width: "33.333%", padding: 3 }}>
      <View style={{ position: "relative" }}>
        <Pressable
          onPress={handlePress}
          onLongPress={handleLongPress}
          delayLongPress={350}
          accessibilityRole="button"
          accessibilityLabel={`${sticker.name}, ${
            isMissing ? "falta" : hasDups ? `tengo ${sticker.count - 1} repetidas` : "pegada"
          }`}
          accessibilityHint="Toca para sumar, manten para restar"
          style={{
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 8,
            padding: 6,
            aspectRatio: 3 / 4,
            alignItems: "center",
            opacity: isMissing ? 0.45 : 1
          }}
        >
          <Text
            style={{
              fontSize: 9,
              color: theme.textMute,
              fontWeight: "700",
              alignSelf: "flex-start"
            }}
            numberOfLines={1}
          >
            {sticker.code}
          </Text>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 8,
              backgroundColor: photoBg,
              alignItems: "center",
              justifyContent: "center",
              marginVertical: 6,
              overflow: "hidden"
            }}
          >
            {sticker.imageUrl ? (
              <Image
                source={{ uri: sticker.imageUrl }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            ) : (
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>
                {getInitials(sticker.name)}
              </Text>
            )}
          </View>
          <Text
            style={{
              fontSize: 10,
              fontWeight: "700",
              color: theme.text,
              textAlign: "center",
              lineHeight: 12
            }}
            numberOfLines={2}
          >
            {sticker.name}
          </Text>
        </Pressable>
        {hasDups && (
          <View
            style={{
              position: "absolute",
              top: -5,
              right: -5,
              backgroundColor: "#ea580c",
              borderRadius: 999,
              paddingHorizontal: 7,
              paddingVertical: 2,
              borderWidth: 2,
              borderColor: "#fff",
              zIndex: 2
            }}
          >
            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>
              ×{sticker.count - 1}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
