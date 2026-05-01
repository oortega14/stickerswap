import { ScrollView, View, Text, Pressable, Linking } from "react-native";
import { useRouter } from "expo-router";
import { StarryBackground } from "@/ui/StarryBackground";
import { GlowCard } from "@/ui/GlowCard";
import { APP_VERSION, BUILD_NUMBER } from "@/lib/version";

const PRIVACY_URL = "https://example.com/panini/privacy";
const TERMS_URL = "https://example.com/panini/terms";

export default function About() {
  const router = useRouter();
  return (
    <StarryBackground>
      <ScrollView className="flex-1 px-4 pt-14">
        <Text className="text-space-violet font-bold tracking-widest text-sm mb-4">
          ACERCA DE
        </Text>
        <GlowCard className="mb-3">
          <Text className="text-space-ink font-bold text-lg">Panini Album</Text>
          <Text className="text-space-mute">Versión {APP_VERSION} (build {BUILD_NUMBER})</Text>
        </GlowCard>

        <Pressable
          onPress={() => Linking.openURL(PRIVACY_URL)}
          className="bg-space-mid rounded-lg py-3 items-center mb-2"
          accessibilityLabel="Política de privacidad"
          accessibilityRole="link"
        >
          <Text className="text-space-ink">Política de privacidad</Text>
        </Pressable>
        <Pressable
          onPress={() => Linking.openURL(TERMS_URL)}
          className="bg-space-mid rounded-lg py-3 items-center"
          accessibilityLabel="Términos de uso"
          accessibilityRole="link"
        >
          <Text className="text-space-ink">Términos de uso</Text>
        </Pressable>

        <Pressable onPress={() => router.back()} className="mt-6 self-center">
          <Text className="text-space-mute">Cerrar</Text>
        </Pressable>
      </ScrollView>
    </StarryBackground>
  );
}
