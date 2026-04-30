import { View, Text, Pressable } from "react-native";
import { StarryBackground } from "@/ui/StarryBackground";
import { GlowCard } from "@/ui/GlowCard";
import { useSession } from "@/auth/useSession";
import { supabase } from "@/auth/supabaseClient";

export default function ProfilePlaceholder() {
  const { user } = useSession();

  return (
    <StarryBackground>
      <View className="flex-1 px-6 pt-14">
        <Text className="text-space-violet font-bold tracking-widest text-sm mb-4">PERFIL</Text>
        <GlowCard className="mb-4">
          <Text className="text-space-ink text-lg font-bold">
            {user?.display_name ?? user?.username}
          </Text>
          <Text className="text-space-mute text-sm">@{user?.username}</Text>
        </GlowCard>
        <Pressable
          onPress={() => supabase.auth.signOut()}
          className="bg-space-dark border border-red-400/30 rounded-lg py-3 items-center"
        >
          <Text className="text-red-300 font-semibold">Cerrar sesión</Text>
        </Pressable>
        <Text className="text-space-dim text-xs text-center mt-6">
          Más opciones de perfil llegan en P3.
        </Text>
      </View>
    </StarryBackground>
  );
}
