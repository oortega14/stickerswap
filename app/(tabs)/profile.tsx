import { ScrollView, View, Text, Pressable, Image, Alert } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { haptics } from "@/lib/haptics";
import QRCode from "react-native-qrcode-svg";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { GlowCard } from "@/ui/GlowCard";
import { useSession } from "@/auth/useSession";
import { supabase } from "@/auth/supabaseClient";

function Initials({ name }: { name: string }) {
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
      style={{ width: 80, height: 80, backgroundColor: "#6b4423" }}
    >
      <Text className="text-white text-2xl font-bold">{initials || "?"}</Text>
    </View>
  );
}

export default function Profile() {
  const router = useRouter();
  const { user } = useSession();

  if (!user) return null;

  const onCopyCode = async () => {
    await Clipboard.setStringAsync(user.invite_code);
    await haptics.success();
    Alert.alert("Copiado", `Tu código ${user.invite_code} está en el portapapeles.`);
  };

  return (
    <ThemedBackground>
      <ScrollView className="flex-1 px-4 pt-14" contentContainerStyle={{ paddingBottom: 32 }}>
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

        <GlowCard className="items-center mb-4">
          <Text className="text-space-mute text-xs tracking-widest mb-2">TU CÓDIGO</Text>
          <View className="bg-white p-3 rounded-lg mb-3">
            <QRCode value={user.invite_code} size={120} backgroundColor="#fff" color="#000" />
          </View>
          <Text className="text-space-ink text-2xl font-mono font-bold tracking-widest">
            {user.invite_code}
          </Text>
          <Pressable
            onPress={onCopyCode}
            className="mt-2"
            accessibilityLabel="Copiar código"
            accessibilityRole="button"
          >
            <Text className="text-space-violet text-xs">Copiar código</Text>
          </Pressable>
        </GlowCard>

        <Pressable
          onPress={() => router.push("/add-friend/scan" as never)}
          className="bg-space-purple rounded-xl py-3 items-center mb-2"
          accessibilityLabel="Escanear código de amigo"
          accessibilityRole="button"
        >
          <Text className="text-white font-semibold">📷 Escanear código de amigo</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/add-friend/search" as never)}
          className="bg-space-mid rounded-xl py-3 items-center mb-2"
          accessibilityLabel="Buscar por username"
          accessibilityRole="button"
        >
          <Text className="text-space-ink font-semibold">⌕ Buscar por @username</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/friends" as never)}
          className="bg-space-mid rounded-xl py-3 items-center mb-2"
          accessibilityLabel="Mis amigos"
          accessibilityRole="button"
        >
          <Text className="text-space-ink font-semibold">👥 Mis amigos</Text>
        </Pressable>

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
