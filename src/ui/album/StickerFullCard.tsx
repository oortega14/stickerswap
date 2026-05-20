import React, { memo, useCallback } from "react";
import { View, Pressable, Text, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { Theme } from "@/theme/themes";
import { haptics } from "@/lib/haptics";
import { getInitials } from "@/domain/playerInitials";
import { getTeamColors } from "@/theme/teamColors";
import type { StickerWithStatus } from "@/domain/types";
import { STICKER_PHOTOS } from "./stickerPhotos";

interface Props {
  sticker: StickerWithStatus;
  teamCode: string | null;
  // Hoisted del parent para evitar instanciar mutations TanStack en cada card.
  theme: Theme;
  onIncrement: (code: string) => void;
  onDecrement: (code: string) => void;
}

function StickerFullCardInner({ sticker, teamCode, theme, onIncrement, onDecrement }: Props) {
  const handlePress = useCallback(() => {
    haptics.light();
    onIncrement(sticker.code);
  }, [sticker.code, onIncrement]);

  const handleLongPress = useCallback(() => {
    if (sticker.count === 0) return;
    haptics.medium();
    onDecrement(sticker.code);
  }, [sticker.code, sticker.count, onDecrement]);

  const isMissing = sticker.count === 0;
  const hasDups = sticker.count > 1;
  const teamColors = teamCode ? getTeamColors(teamCode) : null;
  const photoBg = teamColors?.bg ?? theme.accent;
  const hasPhoto = !!STICKER_PHOTOS[sticker.code] || !!sticker.imageUrl;

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
            backgroundColor: photoBg,
            borderRadius: 10,
            aspectRatio: 3 / 4,
            overflow: "hidden",
            opacity: isMissing ? 0.45 : 1
          }}
        >
          {/* Foto (full bleed) o iniciales fallback */}
          {STICKER_PHOTOS[sticker.code] ? (
            <Image
              source={STICKER_PHOTOS[sticker.code]}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          ) : sticker.imageUrl ? (
            <Image
              source={{ uri: sticker.imageUrl }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontSize: 32, fontWeight: "800" }}>
                {getInitials(sticker.name)}
              </Text>
            </View>
          )}

          {/* Overlay abajo con gradiente fade (estilo Netflix). Solo si hay foto,
              porque sobre iniciales con el color del equipo se ve raro. */}
          {hasPhoto && (
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.6)", "rgba(0,0,0,0.98)"]}
              locations={[0, 0.3, 1]}
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: "45%",
                padding: 7,
                justifyContent: "flex-end"
              }}
              pointerEvents="none"
            >
              <Text
                style={{
                  color: "#fff",
                  fontSize: 8,
                  fontWeight: "700",
                  opacity: 0.85,
                  letterSpacing: 0.4
                }}
                numberOfLines={1}
              >
                {sticker.code}
              </Text>
              <Text
                style={{
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: "800",
                  marginTop: 1,
                  lineHeight: 12,
                  textShadowColor: "rgba(0,0,0,0.6)",
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 2
                }}
                numberOfLines={2}
              >
                {sticker.name}
              </Text>
            </LinearGradient>
          )}

          {/* Sin foto: muestro codigo + nombre debajo de las iniciales para no
              perder la informacion del cromo */}
          {!hasPhoto && (
            <View
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                padding: 6,
                backgroundColor: "rgba(0,0,0,0.55)"
              }}
              pointerEvents="none"
            >
              <Text style={{ color: "#fff", fontSize: 8, fontWeight: "700", opacity: 0.85 }} numberOfLines={1}>
                {sticker.code}
              </Text>
              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800", lineHeight: 12 }} numberOfLines={2}>
                {sticker.name}
              </Text>
            </View>
          )}
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

export const StickerFullCard = memo(StickerFullCardInner);
