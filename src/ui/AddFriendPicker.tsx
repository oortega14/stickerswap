import { Modal, View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";

export function AddFriendPicker({
  visible,
  onClose
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { theme } = useTheme();

  const goScan = () => {
    onClose();
    router.push("/add-friend/scan" as never);
  };
  const goSearch = () => {
    onClose();
    router.push("/add-friend/search" as never);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: theme.bg,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 32
          }}
        >
          <Text style={{ color: theme.textMute, fontSize: 11, letterSpacing: 1, fontWeight: "700", marginBottom: 12 }}>
            AGREGAR AMIGO
          </Text>

          <Pressable
            onPress={goScan}
            accessibilityRole="button"
            accessibilityLabel="Escanear código de amigo"
            style={{
              backgroundColor: theme.accent,
              paddingVertical: 14,
              borderRadius: 10,
              alignItems: "center",
              marginBottom: 8
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>📷  Escanear código</Text>
          </Pressable>

          <Pressable
            onPress={goSearch}
            accessibilityRole="button"
            accessibilityLabel="Buscar por username"
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderWidth: 1,
              paddingVertical: 14,
              borderRadius: 10,
              alignItems: "center"
            }}
          >
            <Text style={{ color: theme.text, fontWeight: "700", fontSize: 14 }}>⌕  Buscar por @username</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
