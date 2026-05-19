import { useState } from "react";
import { View, Text, Pressable, Alert, ActivityIndicator, Linking } from "react-native";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { GlowCard } from "@/ui/GlowCard";
import { AuthToggleBar } from "@/ui/AuthToggleBar";
import { signInWithGoogle, isCancelError } from "@/auth/google";
import { useT } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { PRIVACY_URL, TERMS_URL } from "@/lib/links";

export default function SignIn() {
  const t = useT();
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);

  const onGoogle = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      if (!isCancelError(e)) {
        Alert.alert("Sign-in", String((e as Error).message ?? e));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ThemedBackground>
      <AuthToggleBar />
      <View className="flex-1 items-center justify-center px-6">
        <Text style={{ fontSize: 56, marginBottom: 4 }}>⚽</Text>
        <Text style={{ fontSize: 32, fontWeight: "800", marginBottom: 6 }}>
          <Text style={{ color: theme.text }}>sticker</Text>
          <Text style={{ color: theme.accent }}>S</Text>
          <Text style={{ color: theme.text }}>wap</Text>
        </Text>
        <Text style={{ color: theme.textMute, textAlign: "center", marginBottom: 40 }}>
          {t("signIn_subtitle")}
        </Text>

        <GlowCard className="w-full mb-3">
          <Pressable
            onPress={onGoogle}
            disabled={busy}
            className="bg-white rounded-lg py-3 items-center"
            accessibilityLabel={t("signIn_googleCta")}
            accessibilityRole="button"
          >
            {busy ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text className="text-black font-semibold">{t("signIn_googleCta")}</Text>
            )}
          </Pressable>
        </GlowCard>

        <Text style={{ color: theme.textMute, fontSize: 11, textAlign: "center", paddingHorizontal: 16 }}>
          {t("signIn_terms_prefix")}
          <Text
            style={{ color: theme.accent, textDecorationLine: "underline" }}
            onPress={() => Linking.openURL(TERMS_URL)}
            accessibilityRole="link"
          >
            {t("signIn_terms_termsLabel")}
          </Text>
          {t("signIn_terms_middle")}
          <Text
            style={{ color: theme.accent, textDecorationLine: "underline" }}
            onPress={() => Linking.openURL(PRIVACY_URL)}
            accessibilityRole="link"
          >
            {t("signIn_terms_privacyLabel")}
          </Text>
          {t("signIn_terms_suffix")}
        </Text>
      </View>
    </ThemedBackground>
  );
}
