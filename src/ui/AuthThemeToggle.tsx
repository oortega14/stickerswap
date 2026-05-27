import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";

export function AuthThemeToggle() {
  const { theme, mode, setMode } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        position: "absolute",
        top: insets.top + 12,
        right: 16,
        zIndex: 10
      }}
    >
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
