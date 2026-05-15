import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { haptics } from "@/lib/haptics";

interface Props {
  onPress: () => void;
}

export function ShareListFab({ onPress }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const handlePress = async () => {
    await haptics.light();
    onPress();
  };
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        bottom: insets.bottom + 24,
        right: 16,
        left: 16,
        alignItems: "flex-end"
      }}
    >
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel="Compartir lista de figuritas"
        style={{
          backgroundColor: theme.accent,
          paddingHorizontal: 18,
          paddingVertical: 12,
          borderRadius: 999,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          shadowColor: "#000",
          shadowOpacity: 0.15,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4
        }}
      >
        <Text style={{ color: theme.bg, fontSize: 16, fontWeight: "700" }}>↗</Text>
        <Text style={{ color: theme.bg, fontSize: 14, fontWeight: "700" }}>Compartir lista</Text>
      </Pressable>
    </View>
  );
}
