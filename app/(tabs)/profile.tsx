import { ScrollView, View, Text, Pressable, Image, Alert } from "react-native";
import { useRouter } from "expo-router";
import { StarryBackground } from "@/ui/StarryBackground";
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
      style={{ width: 80, height: 80, backgroundColor: "#7c5cff" }}
    >
      <Text className="text-white text-2xl font-bold">{initials || "?"}</Text>
    </View>
  );
}

export default function Profile() {
  const router = useRouter();
  const { user } = useSession();

  if (!user) return null;

  const onSignOut = () => {
    Alert.alert("Cerrar sesión", "¿Seguro que querés salir?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Salir",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
        }
      }
    ]);
  };

  return (
    <StarryBackground>
      <ScrollView className="flex-1 px-4 pt-14" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-space-violet font-bold tracking-widest text-sm mb-4">PERFIL</Text>

        <GlowCard className="items-center mb-4">
          {user.avatar_url ? (
            <Image
              source={{ uri: user.avatar_url }}
              style={{ width: 80, height: 80, borderRadius: 40 }}
            />
          ) : (
            <Initials name={user.display_name ?? user.username} />
          )}
          <Text className="text-space-ink text-lg font-bold mt-3">
            {user.display_name ?? user.username}
          </Text>
          <Text className="text-space-mute text-sm">@{user.username}</Text>
        </GlowCard>

        <Pressable
          onPress={() => router.push("/profile/edit" as never)}
          className="bg-space-mid rounded-lg py-3 items-center mb-2"
        >
          <Text className="text-space-ink font-semibold">Editar perfil</Text>
        </Pressable>

        <Pressable
          onPress={onSignOut}
          className="bg-space-dark border border-red-400/30 rounded-lg py-3 items-center"
        >
          <Text className="text-red-300 font-semibold">Cerrar sesión</Text>
        </Pressable>
      </ScrollView>
    </StarryBackground>
  );
}
