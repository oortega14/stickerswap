import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, Pressable } from "react-native";
import { StarryBackground } from "@/ui/StarryBackground";
import { GlowGradientCard } from "@/ui/GlowGradientCard";
import { markOnboardingSeen } from "@/lib/onboarding";

const STEPS: Record<string, { title: string; body: string; cta: string; next: string }> = {
  "1": {
    title: "Tu álbum, en tu bolsillo",
    body: "Tracking de las 670 figuritas del Mundial 2026.",
    cta: "Siguiente",
    next: "/onboarding/2"
  },
  "2": {
    title: "Tap = pegada · Long-press = quitar",
    body: "Marcá rápido. Las repetidas las cuenta solas.",
    cta: "Siguiente",
    next: "/onboarding/3"
  },
  "3": {
    title: "Cambios con amigos",
    body: "Agregá amigos por código y la app te muestra qué tiene cada uno que vos necesitás.",
    cta: "Empezar",
    next: "(tabs)"
  }
};

export default function OnboardingStep() {
  const { step } = useLocalSearchParams<{ step: string }>();
  const router = useRouter();
  const data = STEPS[step ?? "1"] ?? STEPS["1"];

  const onNext = async () => {
    if (data.next === "(tabs)") {
      await markOnboardingSeen();
      router.replace("/(tabs)" as never);
    } else {
      router.push(data.next as never);
    }
  };

  return (
    <StarryBackground>
      <View className="flex-1 px-6 justify-center">
        <Text className="text-space-violet text-xs tracking-widest mb-2">
          {step}/3
        </Text>
        <Text className="text-space-ink text-3xl font-bold mb-3">{data.title}</Text>
        <Text className="text-space-mute text-base mb-10">{data.body}</Text>
        <GlowGradientCard>
          <Pressable
            onPress={onNext}
            className="py-3 items-center"
            accessibilityLabel={data.cta}
            accessibilityRole="button"
          >
            <Text className="text-white font-semibold">{data.cta}</Text>
          </Pressable>
        </GlowGradientCard>
      </View>
    </StarryBackground>
  );
}
