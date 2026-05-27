import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text } from "react-native";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { AuthThemeToggle } from "@/ui/AuthThemeToggle";
import { PrimaryButton } from "@/ui/PrimaryButton";
import { useTheme } from "@/theme/ThemeProvider";
import { useT } from "@/i18n/I18nProvider";
import { markOnboardingSeen } from "@/lib/onboarding";
import type { StringKey } from "@/i18n/strings";

interface StepData {
  titleKey: StringKey;
  bodyKey: StringKey;
  ctaKey: StringKey;
  next: string;
}

const STEPS: Record<string, StepData> = {
  "1": { titleKey: "onb1_title", bodyKey: "onb1_body", ctaKey: "onb1_cta", next: "/onboarding/2" },
  "2": { titleKey: "onb2_title", bodyKey: "onb2_body", ctaKey: "onb2_cta", next: "/onboarding/3" },
  "3": { titleKey: "onb3_title", bodyKey: "onb3_body", ctaKey: "onb3_cta", next: "(tabs)" }
};

export default function OnboardingStep() {
  const { step } = useLocalSearchParams<{ step: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const t = useT();
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
    <ThemedBackground>
      <AuthThemeToggle />
      <View className="flex-1 px-6 justify-center">
        <Text
          style={{
            color: theme.accent,
            fontSize: 11,
            fontWeight: "700",
            letterSpacing: 2,
            marginBottom: 12
          }}
        >
          {t("onb_step")} {step}/3
        </Text>
        <Text style={{ color: theme.text, fontSize: 30, fontWeight: "800", marginBottom: 16, lineHeight: 36 }}>
          {t(data.titleKey)}
        </Text>
        <Text style={{ color: theme.textMute, fontSize: 16, lineHeight: 24, marginBottom: 40 }}>
          {t(data.bodyKey)}
        </Text>
        <PrimaryButton
          label={t(data.ctaKey)}
          onPress={onNext}
          accessibilityLabel={t(data.ctaKey)}
        />
      </View>
    </ThemedBackground>
  );
}
