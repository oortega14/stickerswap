import React, { useCallback } from "react";
import { View, Pressable, Text, Platform, type TextStyle } from "react-native";
import { FlagSvg } from "@/ui/flags/FlagSvg";
import { haptics } from "@/lib/haptics";
import { useIncrement, useDecrement } from "@/hooks/useStickers";
import { useTheme } from "@/theme/ThemeProvider";
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
}

export function StickerBolita({ sticker, teamCode }: Props) {
  const { theme, mode } = useTheme();
  const inc = useIncrement();
  const dec = useDecrement();
  // Gris visible para "no la tengo": slate-300 en light, slate-600 en dark.
  // Distinto del bg/card del theme para que la bolita misma se distinga
  // del fondo del colapsible.
  const missingBg = mode === "dark" ? "#475569" : "#cbd5e1";

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
    <View style={{ width: "25%", padding: 5 }}>
      <View style={{ position: "relative", aspectRatio: 1 }}>
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
            width: "100%",
            height: "100%",
            borderRadius: 9999,
            overflow: "hidden",
            borderWidth: 2,
            borderColor: "rgba(0,0,0,0.1)"
          }}
        >
          {isMissing ? (
            <View
              style={{
                width: "100%",
                height: "100%",
                backgroundColor: missingBg
              }}
            />
          ) : (
            <FlagSvg code={teamCode} section={sticker.section} />
          )}
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
                paddingHorizontal: 10,
                paddingVertical: 4,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.15,
                shadowRadius: 2,
                elevation: 2
              }}
            >
              <Text style={[HEAVY_TEXT, { fontSize: 13, color: "#1c1917", letterSpacing: 0.2 }]}>
                {sticker.code}
              </Text>
            </View>
          </View>
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
