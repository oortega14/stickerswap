import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { useTheme } from "@/theme/ThemeProvider";
import type { AuthPromptReason } from "@/auth/useRequiresAuth";

const COPY: Record<AuthPromptReason, { icon: string; title: string; body: string }> = {
  friends: {
    icon: "👥",
    title: "Conecta con amigos",
    body: "Agrega amigos, ve qué láminas les faltan y descubre qué pueden intercambiar contigo. Necesitas una cuenta para empezar."
  },
  trades: {
    icon: "🔁",
    title: "Intercambia tus repetidas",
    body: "Propón cambios a tus amigos directo desde la app y confirma cuando se concretan."
  },
  sync: {
    icon: "☁️",
    title: "Sincroniza entre dispositivos",
    body: "Lleva tu álbum a todos tus dispositivos. Tu progreso actual se mantiene cuando inicies sesión."
  },
  share: {
    icon: "🔗",
    title: "Comparte tu lista",
    body: "Genera un link que tus amigos abren para ver qué te falta y qué tenés repetido."
  },
  nearby: {
    icon: "📍",
    title: "Gente cerca de ti",
    body: "Personas de tu ciudad podrán proponerte intercambios y vos a ellas."
  }
};

interface Props {
  reason: AuthPromptReason;
}

export function SocialPaywall({ reason }: Props) {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const copy = COPY[reason];

  return (
    <ThemedBackground>
      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 24,
          paddingHorizontal: 28,
          paddingBottom: insets.bottom + 24,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <Text style={{ fontSize: 64, marginBottom: 16 }}>{copy.icon}</Text>
        <Text
          style={{
            color: theme.text,
            fontSize: 26,
            fontWeight: "800",
            textAlign: "center",
            marginBottom: 12
          }}
        >
          {copy.title}
        </Text>
        <Text
          style={{
            color: theme.textMute,
            fontSize: 16,
            lineHeight: 24,
            textAlign: "center",
            marginBottom: 32
          }}
        >
          {copy.body}
        </Text>
        <Pressable
          onPress={() =>
            router.push({ pathname: "/(auth)/sign-in", params: { returnTo: "social" } } as never)
          }
          style={{
            backgroundColor: theme.accent,
            borderRadius: 12,
            paddingVertical: 14,
            paddingHorizontal: 32,
            alignSelf: "stretch",
            alignItems: "center"
          }}
          accessibilityRole="button"
          accessibilityLabel="Iniciar sesión"
        >
          <Text style={{ color: theme.bg, fontSize: 16, fontWeight: "700" }}>Iniciar sesión</Text>
        </Pressable>
      </View>
    </ThemedBackground>
  );
}
