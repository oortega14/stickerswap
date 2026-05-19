import { useEffect, useState } from "react";
import { View, Text, TextInput, ActivityIndicator, Alert, Keyboard } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { GlowCard } from "@/ui/GlowCard";
import { AuthToggleBar } from "@/ui/AuthToggleBar";
import { PrimaryButton } from "@/ui/PrimaryButton";
import { isValidUsername, isUsernameTaken } from "@/auth/username";
import { useSession, useSessionStore } from "@/auth/useSession";
import { supabase } from "@/auth/supabaseClient";
import { useTheme } from "@/theme/ThemeProvider";
import { useT } from "@/i18n/I18nProvider";

type CheckState = "idle" | "checking" | "valid" | "invalid" | "taken";

export default function Onboarding() {
  const { theme } = useTheme();
  const t = useT();
  const router = useRouter();
  const { user } = useSession();
  const [value, setValue] = useState(user?.username ?? "");
  const [state, setState] = useState<CheckState>("idle");
  const [saving, setSaving] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!user?.id) return;
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
      Alert.alert(t("username_save_error_title"), error.message);
      return;
    }
    useSessionStore.getState().setProfile({ ...user, username: value });
    router.push("/(auth)/location" as never);
  };

  const hint =
    state === "invalid"
      ? t("username_hint_invalid")
      : state === "taken"
      ? t("username_hint_taken")
      : state === "valid"
      ? t("username_hint_valid")
      : state === "checking"
      ? t("username_hint_checking")
      : " ";

  return (
    <ThemedBackground>
      <AuthToggleBar />
      <View className="flex-1 px-6" style={{ paddingTop: insets.top + 64 }}>
        <Text style={{ color: theme.text, fontSize: 28, fontWeight: "800", marginBottom: 6 }}>
          {t("username_title")}
        </Text>
        <Text style={{ color: theme.textMute, marginBottom: 24 }}>
          {t("username_subtitle")}
        </Text>

        <GlowCard className="mb-4">
          <Text style={{ color: theme.textMute, fontSize: 11, marginBottom: 4 }}>
            {t("username_label")}
          </Text>
          <TextInput
            value={value}
            onChangeText={(s) => setValue(s.toLowerCase())}
            placeholder="oscar_demo"
            placeholderTextColor={theme.textMute}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              color: theme.text,
              backgroundColor: theme.bg,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 18,
              borderWidth: 1,
              borderColor: theme.border
            }}
            maxLength={20}
          />
          <Text style={{ color: theme.textMute, fontSize: 11, marginTop: 8 }}>{hint}</Text>
        </GlowCard>

        <PrimaryButton
          label={t("username_continue")}
          onPress={onSave}
          disabled={state !== "valid"}
          loading={saving}
          accessibilityLabel={t("username_continue")}
        />
      </View>
    </ThemedBackground>
  );
}
