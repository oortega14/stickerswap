import React, { memo, useCallback } from "react";
import { View, Pressable, Text, Platform, type TextStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { FlagSvg } from "@/ui/flags/FlagSvg";
import { haptics } from "@/lib/haptics";
import type { StickerWithStatus } from "@/domain/types";

// Android no renderea fontWeight numerico (800/900) sin fuentes custom;
// usamos la variante sans-serif-black del sistema con weight normal.
const HEAVY_TEXT: TextStyle = Platform.select({
  android: { fontFamily: "sans-serif-black", fontWeight: "normal" },
  default: { fontWeight: "800" }
}) as TextStyle;

interface Props {
  sticker: StickerWithStatus;
  teamCode: string | null;
  // Hoisted del parent para evitar instanciar 20 mutations TanStack por team.
  missingBg: string;
  onIncrement: (code: string) => void;
  onDecrement: (code: string) => void;
}

function StickerBolitaInner({ sticker, teamCode, missingBg, onIncrement, onDecrement }: Props) {
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

  return (
    <View style={{ width: "25%", padding: 5 }}>
      <View style={{ position: "relative", aspectRatio: 1 }}>
        <Pressable
          onPress={handlePress}
          onLongPress={handleLongPress}
          delayLongPress={350}
          accessibilityRole="button"
          accessibilityLabel={`${sticker.code}, ${
            isMissing ? "falta" : hasDups ? `tengo ${sticker.count - 1} repetidas` : "pegada"
          }`}
          accessibilityHint="Toca para sumar, manten para restar"
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 8,
            overflow: "hidden",
            backgroundColor: missingBg
          }}
        >
          {!isMissing && <FlagSvg code={teamCode} section={sticker.section} />}

          {/* Overlay abajo con fade + codigo (estilo Netflix). Solo si tengo
              el cromo (sino es un cuadro gris que ya dice "me falta"). */}
          {!isMissing && (
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.25)", "rgba(0,0,0,0.55)"]}
              locations={[0, 0.4, 1]}
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: "40%",
                paddingHorizontal: 6,
                paddingBottom: 5,
                justifyContent: "flex-end"
              }}
              pointerEvents="none"
            >
              <Text
                style={[
                  HEAVY_TEXT,
                  {
                    fontSize: 11,
                    color: "#fff",
                    letterSpacing: 0.3,
                    textShadowColor: "rgba(0,0,0,0.85)",
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 3
                  }
                ]}
                numberOfLines={1}
              >
                {sticker.code}
              </Text>
            </LinearGradient>
          )}

          {/* Si falta: pill blanco con codigo centrado para identificarlo */}
          {isMissing && (
            <View
              style={{
                position: "absolute",
                top: 0, left: 0, right: 0, bottom: 0,
                alignItems: "center",
                justifyContent: "center"
              }}
              pointerEvents="none"
            >
              <View
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 999,
                  paddingHorizontal: 9,
                  paddingVertical: 3,
                  opacity: 0.85
                }}
              >
                <Text style={[HEAVY_TEXT, { fontSize: 11, color: "#1c1917", letterSpacing: 0.2 }]}>
                  {sticker.code}
                </Text>
              </View>
            </View>
          )}
        </Pressable>
        {hasDups && (
          <View
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              backgroundColor: "#ea580c",
              borderRadius: 999,
              paddingHorizontal: 7,
              paddingVertical: 2,
              borderWidth: 2,
              borderColor: "#fff",
              zIndex: 2
            }}
          >
            <Text style={[HEAVY_TEXT, { color: "#fff", fontSize: 11 }]}>
              ×{sticker.count - 1}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export const StickerBolita = memo(StickerBolitaInner);
