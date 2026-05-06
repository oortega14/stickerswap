import { useState } from "react";
import { View, Text, TextInput, Pressable, Alert, Switch, ScrollView } from "react-native";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { GlowCard } from "@/ui/GlowCard";
import { AuthToggleBar } from "@/ui/AuthToggleBar";
import { PrimaryButton } from "@/ui/PrimaryButton";
import { useSession, useSessionStore } from "@/auth/useSession";
import { supabase } from "@/auth/supabaseClient";
import { updateLocation } from "@/social/locationProfile";
import { citySlug } from "@/lib/citySlug";
import { useTheme } from "@/theme/ThemeProvider";
import { useT } from "@/i18n/I18nProvider";

const COUNTRIES: { code: string; label: string }[] = [
  { code: "AR", label: "Argentina" },
  { code: "BR", label: "Brasil" },
  { code: "CO", label: "Colombia" },
  { code: "MX", label: "México" },
  { code: "US", label: "Estados Unidos" },
  { code: "CA", label: "Canadá" },
  { code: "ES", label: "España" },
  { code: "FR", label: "Francia" },
  { code: "DE", label: "Alemania" },
  { code: "PT", label: "Portugal" },
  { code: "UY", label: "Uruguay" },
  { code: "EC", label: "Ecuador" },
  { code: "PY", label: "Paraguay" },
  { code: "CL", label: "Chile" },
  { code: "PE", label: "Perú" },
  { code: "JP", label: "Japón" },
  { code: "KR", label: "Corea del Sur" },
  { code: "OT", label: "Otro" }
];

export default function LocationStep() {
  const { user } = useSession();
  const { theme } = useTheme();
  const t = useT();
  const [country, setCountry] = useState<string | null>("CO");
  const [city, setCity] = useState("");
  const [discoverable, setDiscoverable] = useState(true);
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const canContinue = !discoverable || (country !== null && city.trim().length > 0);

  const onSave = async () => {
    if (!canContinue) return;
    setSaving(true);
    try {
      await updateLocation(user.id, {
        country: discoverable ? country : null,
        cityLabel: discoverable ? city.trim() : null,
        discoverable
      });
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", user.id);
      if (error) throw error;
      useSessionStore.getState().setProfile({
        ...user,
        country: discoverable ? country : null,
        city_label: discoverable ? city.trim() : null,
        city_slug: discoverable && city.trim().length > 0 ? citySlug(city.trim()) : null,
        discoverable,
        onboarding_completed: true
      });
    } catch (e: unknown) {
      Alert.alert(t("location_save_error_title"), (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedBackground>
      <AuthToggleBar />
      <ScrollView className="flex-1 px-6 pt-32" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text style={{ color: theme.text, fontSize: 28, fontWeight: "800", marginBottom: 6 }}>
          {t("location_title")}
        </Text>
        <Text style={{ color: theme.textMute, marginBottom: 24 }}>
          {t("location_subtitle")}
        </Text>

        <GlowCard className="mb-3">
          <Text style={{ color: theme.textMute, fontSize: 11, marginBottom: 8 }}>
            {t("location_country")}
          </Text>
          <View className="flex-row flex-wrap" style={{ gap: 6 }}>
            {COUNTRIES.map((c) => (
              <Pressable
                key={c.code}
                onPress={() => setCountry(c.code)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: country === c.code ? theme.text : theme.bg,
                  borderWidth: 1,
                  borderColor: country === c.code ? theme.text : theme.border
                }}
                accessibilityRole="button"
                accessibilityLabel={c.label}
                accessibilityState={{ selected: country === c.code }}
              >
                <Text style={{ color: country === c.code ? theme.bg : theme.text, fontSize: 13 }}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </GlowCard>

        <GlowCard className="mb-3">
          <Text style={{ color: theme.textMute, fontSize: 11, marginBottom: 4 }}>
            {t("location_city")}
          </Text>
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder={t("location_city_placeholder")}
            placeholderTextColor={theme.textMute}
            autoCapitalize="words"
            autoCorrect={false}
            style={{
              color: theme.text,
              backgroundColor: theme.bg,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 16,
              borderWidth: 1,
              borderColor: theme.border
            }}
            maxLength={50}
          />
        </GlowCard>

        <GlowCard className="mb-6">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text style={{ color: theme.text, fontSize: 15, fontWeight: "600" }}>
                {t("location_discoverable_title")}
              </Text>
              <Text style={{ color: theme.textMute, fontSize: 12, marginTop: 4 }}>
                {t("location_discoverable_subtitle")}
              </Text>
            </View>
            <Switch
              value={discoverable}
              onValueChange={setDiscoverable}
              trackColor={{ false: theme.textMute, true: theme.accent }}
              thumbColor={theme.card}
              accessibilityRole="switch"
              accessibilityState={{ checked: discoverable }}
            />
          </View>
        </GlowCard>

        <PrimaryButton
          label={t("location_continue")}
          onPress={onSave}
          disabled={!canContinue}
          loading={saving}
          accessibilityLabel={t("location_continue")}
        />
      </ScrollView>
    </ThemedBackground>
  );
}
