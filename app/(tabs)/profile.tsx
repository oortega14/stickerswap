import { useCallback, useState } from "react";
import { ScrollView, View, Text, Pressable, Image, Alert, Switch } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { GlowCard } from "@/ui/GlowCard";
import { useSession } from "@/auth/useSession";
import { supabase } from "@/auth/supabaseClient";
import { useTheme } from "@/theme/ThemeProvider";
import { clearUserLocalData } from "@/data/localReset";

function Initials({ name }: { name: string }) {
  const { theme } = useTheme();
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <View
      className="rounded-full items-center justify-center"
      style={{ width: 80, height: 80, backgroundColor: theme.accent }}
    >
      <Text className="text-white text-2xl font-bold">{initials || "?"}</Text>
    </View>
  );
}

export default function Profile() {
  const router = useRouter();
  const { user } = useSession();
  const { theme, mode, setMode } = useTheme();
  const insets = useSafeAreaInsets();

  // Tras varios detach/reattach de react-native-screens, el árbol nativo de
  // esta pantalla se queda en blanco si nunca re-rendea. Forzamos un re-render
  // en cada focus para que React repinte y el layout se reconstruya.
  const [, bumpOnFocus] = useState(0);
  useFocusEffect(
    useCallback(() => {
      bumpOnFocus((n) => n + 1);
    }, [])
  );

  if (!user) return null;

  return (
    <ThemedBackground>
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 32 }}>
        <Text className="text-space-violet font-bold tracking-widest text-sm mb-4">PERFIL</Text>

        <GlowCard className="items-center mb-4">
          {user.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={{ width: 80, height: 80, borderRadius: 40 }} />
          ) : (
            <Initials name={user.display_name ?? user.username} />
          )}
          <Text className="text-space-ink text-lg font-bold mt-3">{user.display_name ?? user.username}</Text>
          <Text className="text-space-mute text-sm">@{user.username}</Text>
        </GlowCard>

        <View className="mb-4">
          <Text className="text-space-mute text-xs tracking-widest mb-2">APARIENCIA</Text>
          <View
            className="rounded-xl bg-space-dark px-4 py-3 flex-row items-center justify-between"
            style={{ borderWidth: 1, borderColor: theme.border }}
          >
            <Text className="text-space-ink text-base">Tema oscuro</Text>
            <Switch
              value={mode === "dark"}
              onValueChange={(v) => setMode(v ? "dark" : "light")}
              trackColor={{ false: theme.textMute, true: theme.accent }}
              thumbColor={theme.card}
              accessibilityLabel="Tema oscuro"
              accessibilityRole="switch"
              accessibilityState={{ checked: mode === "dark" }}
            />
          </View>
        </View>

        <Pressable
          onPress={() => router.push("/profile/edit" as never)}
          className="bg-space-mid rounded-xl py-3 items-center mb-2"
          accessibilityLabel="Editar perfil"
          accessibilityRole="button"
        >
          <Text className="text-space-ink font-semibold">Editar perfil</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/about" as never)}
          className="bg-space-mid rounded-xl py-3 items-center mb-2"
          accessibilityLabel="Acerca de"
          accessibilityRole="button"
        >
          <Text className="text-space-ink">Acerca de</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            Alert.alert("Cerrar sesión", "¿Seguro?", [
              { text: "Cancelar", style: "cancel" },
              { text: "Salir", style: "destructive", onPress: () => supabase.auth.signOut() }
            ]);
          }}
          className="bg-space-dark border border-red-400/30 rounded-xl py-3 items-center"
          accessibilityLabel="Cerrar sesión"
          accessibilityRole="button"
        >
          <Text className="text-red-300 font-semibold">Cerrar sesión</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            Alert.alert(
              "Borrar cuenta",
              "Vas a borrar tu cuenta y todos tus datos. Esto no se puede deshacer.",
              [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Borrar",
                  style: "destructive",
                  onPress: async () => {
                    const { error } = await supabase.rpc("delete_my_account");
                    if (error) {
                      Alert.alert("Error", error.message);
                      return;
                    }
                    await clearUserLocalData();
                    await supabase.auth.signOut();
                  }
                }
              ]
            );
          }}
          className="bg-space-dark border border-red-500/40 rounded-xl py-3 items-center mt-3"
          accessibilityLabel="Borrar cuenta"
          accessibilityRole="button"
        >
          <Text className="text-red-400 font-semibold">Borrar cuenta</Text>
        </Pressable>
      </ScrollView>
    </ThemedBackground>
  );
}
