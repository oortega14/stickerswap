import { useState } from "react";
import { View, Text, Pressable, Alert, ActivityIndicator } from "react-native";
import { StarryBackground } from "@/ui/StarryBackground";
import { GlowCard } from "@/ui/GlowCard";
import { signInWithGoogle, isCancelError } from "@/auth/google";

export default function SignIn() {
  const [busy, setBusy] = useState(false);

  const onGoogle = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      if (!isCancelError(e)) {
        Alert.alert("No se pudo iniciar sesión", String((e as Error).message ?? e));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <StarryBackground>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-space-violet font-bold text-3xl mb-2">🪐 Panini</Text>
        <Text className="text-space-mute text-center mb-10">
          Tu álbum del Mundial 2026 en la nube.
        </Text>

        <GlowCard className="w-full mb-3">
          <Pressable
            onPress={onGoogle}
            disabled={busy}
            className="bg-white rounded-lg py-3 items-center"
            accessibilityLabel="Continuar con Google"
            accessibilityRole="button"
          >
            {busy ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text className="text-black font-semibold">Continuar con Google</Text>
            )}
          </Pressable>
        </GlowCard>

        <Text className="text-space-dim text-xs text-center px-4">
          Al continuar aceptás los términos y la política de privacidad.
        </Text>
      </View>
    </StarryBackground>
  );
}
