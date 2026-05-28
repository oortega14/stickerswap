import { Modal, View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import { useRequiresAuthStore, type AuthPromptReason } from "@/auth/useRequiresAuth";

const COPY: Record<AuthPromptReason, { title: string; body: string }> = {
  friends: {
    title: "Inicia sesión para conectar con amigos",
    body: "Agrega amigos, ve qué láminas les faltan y descubre qué pueden intercambiar contigo."
  },
  trades: {
    title: "Inicia sesión para intercambiar",
    body: "Propón cambios a tus amigos directo desde la app y confirma cuando se concretan."
  },
  sync: {
    title: "Inicia sesión para sincronizar",
    body: "Lleva tu álbum a todos tus dispositivos. Tu progreso actual se conserva."
  },
  share: {
    title: "Inicia sesión para compartir tu lista",
    body: "Genera un link que tus amigos abren para ver qué te falta y qué tenés repetido."
  },
  nearby: {
    title: "Inicia sesión para encontrar gente cerca",
    body: "Personas de tu ciudad podrán proponerte intercambios y vos a ellas."
  }
};

export function AuthPromptSheet() {
  const { theme } = useTheme();
  const router = useRouter();
  const open = useRequiresAuthStore((s) => s.open);
  const reason = useRequiresAuthStore((s) => s.reason);
  const closePrompt = useRequiresAuthStore((s) => s.closePrompt);

  const copy = reason ? COPY[reason] : null;

  const onSignIn = () => {
    closePrompt();
    router.push({ pathname: "/(auth)/sign-in", params: { returnTo: "social" } } as never);
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={closePrompt}
    >
      <Pressable
        onPress={closePrompt}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: theme.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: 36
          }}
        >
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: "center", marginBottom: 20 }} />
          {copy ? (
            <>
              <Text style={{ color: theme.text, fontSize: 22, fontWeight: "800", marginBottom: 10 }}>
                {copy.title}
              </Text>
              <Text style={{ color: theme.textMute, fontSize: 15, lineHeight: 22, marginBottom: 24 }}>
                {copy.body}
              </Text>
            </>
          ) : null}
          <Pressable
            onPress={onSignIn}
            style={{
              backgroundColor: theme.accent,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: "center",
              marginBottom: 8
            }}
            accessibilityRole="button"
            accessibilityLabel="Iniciar sesión"
          >
            <Text style={{ color: theme.bg, fontSize: 16, fontWeight: "700" }}>Iniciar sesión</Text>
          </Pressable>
          <Pressable
            onPress={closePrompt}
            style={{ paddingVertical: 12, alignItems: "center" }}
            accessibilityRole="button"
            accessibilityLabel="Ahora no"
          >
            <Text style={{ color: theme.textMute, fontSize: 15 }}>Ahora no</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
