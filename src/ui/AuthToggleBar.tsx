import { View, Text, Pressable } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useI18n } from "@/i18n/I18nProvider";

/**
 * Barra superior con toggles de tema (☀/☾) y idioma (ES/EN).
 * Se monta en las pantallas de (auth) y onboarding intro para que el
 * usuario pueda configurar antes incluso de loguearse.
 */
export function AuthToggleBar() {
  const { theme, mode, setMode } = useTheme();
  const { lang, setLang } = useI18n();

  return (
    <View
      style={{
        position: "absolute",
        top: 56,
        right: 16,
        flexDirection: "row",
        gap: 8,
        zIndex: 10
      }}
    >
      <Pressable
        onPress={() => setLang(lang === "es" ? "en" : "es")}
        accessibilityRole="button"
        accessibilityLabel={lang === "es" ? "Switch to English" : "Cambiar a español"}
        style={{
          paddingHorizontal: 10,
          height: 36,
          borderRadius: 18,
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: theme.border,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row"
        }}
      >
        <Text style={{ color: theme.text, fontSize: 12, fontWeight: "700" }}>
          {lang === "es" ? "ES" : "EN"}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => setMode(mode === "dark" ? "light" : "dark")}
        accessibilityRole="button"
        accessibilityLabel="Cambiar tema"
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: theme.border,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <Text style={{ color: theme.text, fontSize: 16 }}>{mode === "dark" ? "☾" : "☀"}</Text>
      </Pressable>
    </View>
  );
}
