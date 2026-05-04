import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, ScrollView, Switch } from "react-native";
import { useRouter } from "expo-router";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { GlowCard } from "@/ui/GlowCard";
import { useSession, useSessionStore } from "@/auth/useSession";
import { supabase } from "@/auth/supabaseClient";
import { updateLocation } from "@/social/locationProfile";
import { citySlug } from "@/lib/citySlug";
import { useTheme } from "@/theme/ThemeProvider";

const COUNTRIES = [
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

export default function EditProfile() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useSession();
  const [name, setName] = useState(user?.display_name ?? "");
  const [country, setCountry] = useState<string | null>(user?.country ?? null);
  const [city, setCity] = useState(user?.city_label ?? "");
  const [discoverable, setDiscoverable] = useState(user?.discoverable ?? false);
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const onSave = async () => {
    if (name.trim().length < 1) {
      Alert.alert("Nombre vacío", "Poné al menos un caracter.");
      return;
    }
    if (discoverable && (!country || city.trim().length === 0)) {
      Alert.alert("Faltan datos", "Si querés ser discoverable, necesitás país y ciudad.");
      return;
    }
    setSaving(true);
    try {
      const { error: nameErr } = await supabase
        .from("profiles")
        .update({ display_name: name.trim() })
        .eq("id", user.id);
      if (nameErr) throw nameErr;

      await updateLocation(user.id, {
        country: discoverable ? country : null,
        cityLabel: discoverable ? city.trim() : null,
        discoverable
      });

      useSessionStore.getState().setProfile({
        ...user,
        display_name: name.trim(),
        country: discoverable ? country : null,
        city_label: discoverable ? city.trim() : null,
        city_slug: discoverable && city.trim().length > 0 ? citySlug(city.trim()) : null,
        discoverable
      });
      router.back();
    } catch (e: unknown) {
      Alert.alert("Error", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedBackground>
      <ScrollView className="flex-1 px-4 pt-14" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-space-violet font-bold tracking-widest text-sm mb-4">EDITAR</Text>

        <GlowCard className="mb-4">
          <Text className="text-space-mute text-xs mb-1">Nombre para mostrar</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Tu nombre"
            placeholderTextColor={theme.textMute}
            className="text-space-ink text-base bg-space-mid rounded-md px-3 py-2"
            maxLength={40}
          />
        </GlowCard>

        <Text className="text-space-mute text-xs tracking-widest mb-2 mt-2">UBICACIÓN E INTERCAMBIOS</Text>

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
              <Text className="text-space-ink text-base font-semibold">Que me encuentren</Text>
              <Text className="text-space-mute text-xs mt-1">
                Si lo apagás, dejás de aparecer en «Cerca de mí» de otros. Tus matches con amigos siguen igual.
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

        <Pressable
          onPress={onSave}
          disabled={saving}
          className="bg-space-purple rounded-xl py-4 items-center mb-2"
          accessibilityLabel="Guardar"
          accessibilityRole="button"
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Guardar</Text>}
        </Pressable>
        <Pressable
          onPress={() => router.back()}
          className="py-3 items-center"
          accessibilityLabel="Cancelar"
          accessibilityRole="button"
        >
          <Text className="text-space-mute">Cancelar</Text>
        </Pressable>
      </ScrollView>
    </ThemedBackground>
  );
}
