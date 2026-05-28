import { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/theme/ThemeProvider";
import { useSessionStore } from "@/auth/useSession";

const STORAGE_KEY = "stickerswap.guestBanner.dismissedAt";
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

export function GuestSyncBanner() {
  const { theme } = useTheme();
  const router = useRouter();
  const session = useSessionStore((s) => s.session);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (session) {
      setVisible(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (!raw) {
          setVisible(true);
          return;
        }
        const ts = parseInt(raw, 10);
        const shouldShow = Number.isFinite(ts) ? Date.now() - ts > COOLDOWN_MS : true;
        setVisible(shouldShow);
      } catch {
        setVisible(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (!visible || session) return null;

  const onDismiss = async () => {
    setVisible(false);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {}
  };

  const onPress = () => {
    router.push("/(auth)/sign-in" as never);
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Inicia sesión para sincronizar e intercambiar"
      style={{
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 10
      }}
    >
      <Text style={{ fontSize: 18 }}>☁️</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text, fontSize: 13, fontWeight: "700" }}>
          Sincroniza e intercambia
        </Text>
        <Text style={{ color: theme.textMute, fontSize: 12 }}>
          Inicia sesión para no perder tu progreso y conectar con amigos.
        </Text>
      </View>
      <Pressable
        onPress={onDismiss}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Cerrar"
        style={{ paddingHorizontal: 4 }}
      >
        <Text style={{ color: theme.textMute, fontSize: 18 }}>×</Text>
      </Pressable>
    </Pressable>
  );
}
