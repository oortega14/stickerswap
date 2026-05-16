import { useEffect, useMemo, useState } from "react";
import { Modal, View, Text, Pressable, ScrollView, Share, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { useTheme } from "@/theme/ThemeProvider";
import { haptics } from "@/lib/haptics";
import { showSnackbar } from "@/ui/Snackbar";
import { PrimaryButton } from "@/ui/PrimaryButton";
import { formatTradeListByTeam } from "@/domain/tradeList";
import type { TradeList } from "@/domain/types";

interface Props {
  visible: boolean;
  onClose: () => void;
  list: TradeList | null;
  username: string | null;
}

const MONO_FONT = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

export function ShareListModal({ visible, onClose, list, username }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [showNeeded, setShowNeeded] = useState(true);
  const [showDuplicates, setShowDuplicates] = useState(true);

  useEffect(() => {
    if (visible) {
      setShowNeeded(true);
      setShowDuplicates(true);
    }
  }, [visible]);

  const isComplete = list != null && list.needed.length === 0 && list.duplicates.length === 0;
  const hasNeeded = (list?.needed.length ?? 0) > 0;
  const hasDuplicates = (list?.duplicates.length ?? 0) > 0;
  const bothOff = !showNeeded && !showDuplicates;
  const showToggles = !isComplete && list != null && (hasNeeded || hasDuplicates);

  const text = useMemo(() => {
    if (!list) return "";
    return formatTradeListByTeam(list, {
      username,
      include: { needed: showNeeded, duplicates: showDuplicates }
    });
  }, [list, username, showNeeded, showDuplicates]);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(text);
    await haptics.success();
    showSnackbar("Copiado ✓");
  };

  const handleShare = async () => {
    await haptics.light();
    try {
      await Share.share({ message: text });
    } catch {
      // usuario canceló el share sheet — no es error
    }
  };

  const toggle = async (which: "needed" | "duplicates") => {
    await haptics.light();
    if (which === "needed") setShowNeeded((v) => !v);
    else setShowDuplicates((v) => !v);
  };

  const buttonsDisabled = bothOff || text.length === 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top + 8 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingBottom: 12
          }}
        >
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "700" }}>
            Mi lista para compartir
          </Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            hitSlop={12}
          >
            <Text style={{ color: theme.text, fontSize: 22 }}>✕</Text>
          </Pressable>
        </View>

        {showToggles && (
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              paddingHorizontal: 16,
              paddingBottom: 12
            }}
          >
            {hasNeeded && (
              <ToggleChip
                label="Me faltan"
                active={showNeeded}
                onPress={() => toggle("needed")}
                accessibilityLabel={showNeeded ? "Ocultar faltantes" : "Mostrar faltantes"}
              />
            )}
            {hasDuplicates && (
              <ToggleChip
                label="Tengo repes"
                active={showDuplicates}
                onPress={() => toggle("duplicates")}
                accessibilityLabel={showDuplicates ? "Ocultar repetidas" : "Mostrar repetidas"}
              />
            )}
          </View>
        )}

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        >
          {isComplete ? (
            <Text
              style={{
                color: theme.text,
                fontSize: 20,
                fontWeight: "600",
                textAlign: "center",
                marginTop: 80
              }}
            >
              Tu álbum está completo 🎉
            </Text>
          ) : bothOff ? (
            <Text
              style={{
                color: theme.textMute,
                fontSize: 14,
                textAlign: "center",
                marginTop: 40
              }}
            >
              Activá al menos una sección.
            </Text>
          ) : (
            <View
              style={{
                backgroundColor: theme.card,
                borderColor: theme.border,
                borderWidth: 1,
                borderRadius: 12,
                padding: 14
              }}
            >
              <Text
                selectable
                style={{
                  color: theme.text,
                  fontSize: 13,
                  lineHeight: 20,
                  fontFamily: MONO_FONT
                }}
              >
                {text}
              </Text>
            </View>
          )}
        </ScrollView>

        {!isComplete && (
          <View
            style={{
              flexDirection: "row",
              gap: 12,
              paddingHorizontal: 16,
              paddingBottom: Math.max(insets.bottom, 16),
              paddingTop: 12,
              borderTopColor: theme.border,
              borderTopWidth: 1,
              backgroundColor: theme.bg
            }}
          >
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Copiar" onPress={handleCopy} disabled={buttonsDisabled} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Compartir" onPress={handleShare} disabled={buttonsDisabled} />
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

function ToggleChip({
  label,
  active,
  onPress,
  accessibilityLabel
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={accessibilityLabel}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: active ? theme.accent : theme.card,
        borderWidth: 1,
        borderColor: active ? theme.accent : theme.border
      }}
    >
      <Text
        style={{
          color: active ? "#fff" : theme.textMute,
          fontSize: 12,
          fontWeight: "600"
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
