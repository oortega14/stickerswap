import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { GlowCard } from "@/ui/GlowCard";
import { useSession } from "@/auth/useSession";
import { supabase } from "@/auth/supabaseClient";
import { colors } from "@/theme/colors";

export default function EditProfile() {
  const router = useRouter();
  const { user } = useSession();
  const [name, setName] = useState(user?.display_name ?? "");
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const onSave = async () => {
    if (name.trim().length < 1) {
      Alert.alert("Nombre vacío", "Poné al menos un caracter.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name.trim() })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
    router.back();
  };

  return (
    <ThemedBackground>
      <View className="flex-1 px-4 pt-14">
        <Text className="text-space-violet font-bold tracking-widest text-sm mb-4">EDITAR</Text>
        <GlowCard className="mb-4">
          <Text className="text-space-mute text-xs mb-1">Nombre para mostrar</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Tu nombre"
            placeholderTextColor={colors.dim}
            className="text-space-ink text-base bg-space-mid rounded-md px-3 py-2"
            maxLength={40}
          />
        </GlowCard>

        <Pressable
          onPress={onSave}
          disabled={saving}
          className="bg-space-purple rounded-xl py-4 items-center mb-2"
          accessibilityLabel="Guardar"
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold">Guardar</Text>
          )}
        </Pressable>
        <Pressable
          onPress={() => router.back()}
          className="py-3 items-center"
          accessibilityLabel="Cancelar"
          accessibilityRole="button"
        >
          <Text className="text-space-mute">Cancelar</Text>
        </Pressable>
      </View>
    </ThemedBackground>
  );
}
