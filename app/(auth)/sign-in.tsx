import { useEffect, useState } from "react";
import { View, Text, Pressable, Alert, ActivityIndicator } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { StarryBackground } from "@/ui/StarryBackground";
import { GlowCard } from "@/ui/GlowCard";
import { isAppleAvailable, signInWithApple } from "@/auth/apple";
import { signInWithGoogle, isCancelError } from "@/auth/google";

export default function SignIn() {
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState<"apple" | "google" | null>(null);

  useEffect(() => {
    isAppleAvailable().then(setAppleAvailable);
  }, []);

  const handle = async (provider: "apple" | "google", fn: () => Promise<void>) => {
    setBusy(provider);
    try {
      await fn();
    } catch (e) {
      if (!isCancelError(e)) {
        Alert.alert("No se pudo iniciar sesión", String((e as Error).message ?? e));
      }
    } finally {
      setBusy(null);
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
          {appleAvailable && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={10}
              style={{ width: "100%", height: 48, marginBottom: 12 }}
              onPress={() => handle("apple", signInWithApple)}
            />
          )}
          <Pressable
            onPress={() => handle("google", signInWithGoogle)}
            disabled={busy !== null}
            className="bg-white rounded-lg py-3 items-center"
          >
            {busy === "google" ? (
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
