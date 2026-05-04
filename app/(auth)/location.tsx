import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, Switch, ScrollView } from "react-native";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { GlowCard } from "@/ui/GlowCard";
import { useSession, useSessionStore } from "@/auth/useSession";
import { supabase } from "@/auth/supabaseClient";
import { updateLocation } from "@/social/locationProfile";
import { citySlug } from "@/lib/citySlug";
import { useTheme } from "@/theme/ThemeProvider";

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
      Alert.alert("No se pudo guardar", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedBackground>
      <ScrollView className="flex-1 px-6 pt-24" keyboardShouldPersistTaps="handled">
        <Text className="text-space-violet font-bold text-2xl mb-1">¿Dónde estás?</Text>
        <Text className="text-space-mute mb-6">
          Para que personas de tu ciudad puedan proponerte intercambios.
        </Text>

        <GlowCard className="mb-3">
          <Text className="text-space-mute text-xs mb-2">País</Text>
          <View className="flex-row flex-wrap" style={{ gap: 6 }}>
            {COUNTRIES.map((c) => (
              <Pressable
                key={c.code}
                onPress={() => setCountry(c.code)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: country === c.code ? theme.accent : theme.card,
                  borderWidth: 1,
                  borderColor: theme.border
                }}
                accessibilityRole="button"
                accessibilityLabel={`País ${c.label}`}
                accessibilityState={{ selected: country === c.code }}
              >
                <Text style={{ color: country === c.code ? "#fff" : theme.text, fontSize: 13 }}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </GlowCard>

        <GlowCard className="mb-3">
          <Text className="text-space-mute text-xs mb-1">Ciudad</Text>
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="Armenia"
            placeholderTextColor={theme.textMute}
            autoCapitalize="words"
            autoCorrect={false}
            className="text-space-ink text-base bg-space-mid rounded-md px-3 py-2"
            maxLength={50}
          />
        </GlowCard>

        <GlowCard className="mb-6">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-space-ink text-base font-semibold">
                Que me encuentren para intercambiar
              </Text>
              <Text className="text-space-mute text-xs mt-1">
                Personas de tu ciudad podrán mandarte solicitudes. Lo apagás cuando quieras desde Perfil.
              </Text>
            </View>
            <Switch
              value={discoverable}
              onValueChange={setDiscoverable}
              trackColor={{ false: theme.textMute, true: theme.accent }}
              thumbColor={theme.card}
              accessibilityRole="switch"
              accessibilityLabel="Discoverable"
              accessibilityState={{ checked: discoverable }}
            />
          </View>
        </GlowCard>

        <Pressable
          disabled={!canContinue || saving}
          onPress={onSave}
          className={`rounded-xl py-4 items-center ${canContinue ? "bg-space-purple" : "bg-space-mid"}`}
          accessibilityLabel="Continuar"
          accessibilityRole="button"
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Continuar</Text>}
        </Pressable>
      </ScrollView>
    </ThemedBackground>
  );
}
