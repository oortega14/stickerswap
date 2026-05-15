import { Modal, View, Text, Pressable, ScrollView, Share, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { useTheme } from "@/theme/ThemeProvider";
import { haptics } from "@/lib/haptics";
import { showSnackbar } from "@/ui/Snackbar";
import { PrimaryButton } from "@/ui/PrimaryButton";

interface Props {
  visible: boolean;
  onClose: () => void;
  text: string;
}

const MONO_FONT = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

export function ShareListModal({ visible, onClose, text }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const isEmptyState = text === "Tu álbum está completo 🎉";

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

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        >
          {isEmptyState ? (
            <Text
              style={{
                color: theme.text,
                fontSize: 20,
                fontWeight: "600",
                textAlign: "center",
                marginTop: 80
              }}
            >
              {text}
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

        {!isEmptyState && (
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
              <PrimaryButton label="Copiar" onPress={handleCopy} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Compartir" onPress={handleShare} />
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}
