import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, Keyboard } from "react-native";
import { StarryBackground } from "@/ui/StarryBackground";
import { GlowCard } from "@/ui/GlowCard";
import { isValidUsername, isUsernameTaken } from "@/auth/username";
import { useSession, useSessionStore } from "@/auth/useSession";
import { supabase } from "@/auth/supabaseClient";
import { colors } from "@/theme/colors";

type CheckState = "idle" | "checking" | "valid" | "invalid" | "taken";

export default function Onboarding() {
  const { user } = useSession();
  // Arrancamos vacío. Pre-llenar con `user.username` confunde al usuario
  // (el default es auto-generado tipo `user_e9fc` y muchos lo apretan
  // creyendo que es su username elegido). Que escriba uno propio.
  const [value, setValue] = useState("");
  const [state, setState] = useState<CheckState>("idle");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return; // esperar a que cargue el profile antes de validar
    if (!isValidUsername(value)) {
      setState(value.length === 0 ? "idle" : "invalid");
      return;
    }
    setState("checking");
    const handle = setTimeout(async () => {
      try {
        const taken = await isUsernameTaken(value, user.id);
        setState(taken ? "taken" : "valid");
      } catch {
        setState("invalid");
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [value, user?.id]);

  const onSave = async () => {
    if (state !== "valid" || !user) return;
    Keyboard.dismiss();
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ username: value })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      Alert.alert("No se pudo guardar", error.message);
      return;
    }
    // El listener de useSession solo se refresca en login/logout. Después de
    // un UPDATE manual, actualizamos el store local para que AuthGate vea el
    // username nuevo y despache a tabs.
    useSessionStore.getState().setProfile({ ...user, username: value });
  };

  const hint =
    state === "invalid"
      ? "3-20 caracteres, solo a-z, 0-9 y _"
      : state === "taken"
      ? "Ese username ya está tomado"
      : state === "valid"
      ? "Disponible ✓"
      : state === "checking"
      ? "Verificando…"
      : " ";

  return (
    <StarryBackground>
      <View className="flex-1 px-6 pt-24">
        <Text className="text-space-violet font-bold text-2xl mb-1">Elegí tu username</Text>
        <Text className="text-space-mute mb-6">Así te encuentran tus amigos para cambios.</Text>

        <GlowCard className="mb-3">
          <Text className="text-space-mute text-xs mb-1">@username</Text>
          <TextInput
            value={value}
            onChangeText={(s) => setValue(s.toLowerCase())}
            placeholder="oscar_panini"
            placeholderTextColor={colors.dim}
            autoCapitalize="none"
            autoCorrect={false}
            className="text-space-ink text-lg bg-space-mid rounded-md px-3 py-2"
            maxLength={20}
          />
          <Text className="text-space-mute text-xs mt-2">{hint}</Text>
        </GlowCard>

        <Pressable
          disabled={state !== "valid" || saving}
          onPress={onSave}
          className={`rounded-xl py-4 items-center ${state === "valid" ? "bg-space-purple" : "bg-space-mid"}`}
          accessibilityLabel="Continuar"
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold">Continuar</Text>
          )}
        </Pressable>
      </View>
    </StarryBackground>
  );
}
