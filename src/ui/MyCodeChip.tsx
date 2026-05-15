import { useState } from "react";
import { View, Text, Pressable, Modal, Share, Alert } from "react-native";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { useSession } from "@/auth/useSession";
import { useTheme } from "@/theme/ThemeProvider";
import { haptics } from "@/lib/haptics";

export function MyCodeChip() {
  const { user } = useSession();
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  if (!user) return null;

  const code = user.invite_code;

  const onShare = async () => {
    await haptics.light();
    await Share.share({
      message: `Agregame en stickerSwap: ${code}`
    });
  };

  const onCopy = async () => {
    await Clipboard.setStringAsync(code);
    await haptics.success();
    Alert.alert("Copiado", `Tu código ${code} está en el portapapeles.`);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Ver mi código QR"
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: theme.card,
          borderColor: theme.border,
          borderWidth: 1,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.textMute, fontSize: 10, letterSpacing: 1, fontWeight: "700" }}>
            MI CÓDIGO
          </Text>
          <Text style={{ color: theme.text, fontSize: 14, fontFamily: "monospace", marginTop: 2 }}>
            {code}
          </Text>
        </View>
        <Pressable
          onPress={onShare}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Compartir mi código"
          style={{ paddingHorizontal: 6 }}
        >
          <Text style={{ color: theme.text, fontSize: 18 }}>📤</Text>
        </Pressable>
      </Pressable>

      <Modal
        visible={open}
        animationType="fade"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" }}
        >
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderWidth: 1,
              borderRadius: 16,
              padding: 24,
              alignItems: "center",
              maxWidth: 320,
              width: "85%"
            }}
          >
            <Text style={{ color: theme.textMute, fontSize: 11, letterSpacing: 1, fontWeight: "700", marginBottom: 14 }}>
              TU CÓDIGO
            </Text>
            <View style={{ backgroundColor: "#fff", padding: 14, borderRadius: 10, marginBottom: 14 }}>
              <QRCode value={code} size={180} backgroundColor="#fff" color="#000" />
            </View>
            <Text style={{ color: theme.text, fontSize: 22, fontFamily: "monospace", fontWeight: "700", letterSpacing: 2, marginBottom: 16 }}>
              {code}
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={onCopy}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  borderWidth: 1
                }}
              >
                <Text style={{ color: theme.text, fontWeight: "600" }}>Copiar</Text>
              </Pressable>
              <Pressable
                onPress={onShare}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: theme.accent
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Compartir</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
