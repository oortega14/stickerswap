import { View, Text, Pressable } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

interface Props {
  onDone: () => void;
  accent: string;
}

export function DestildarBanner({ onDone, accent }: Props) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        position: "absolute",
        top: 100,
        left: 16,
        right: 16,
        backgroundColor: accent,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        zIndex: 10,
        shadowColor: theme.text,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
        elevation: 6
      }}
    >
      <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600", flex: 1, marginRight: 12 }}>
        Modo destildar · tocá las que te falten
      </Text>
      <Pressable
        onPress={onDone}
        accessibilityRole="button"
        accessibilityLabel="Salir del modo destildar"
        hitSlop={8}
        style={{
          backgroundColor: "rgba(255,255,255,0.22)",
          paddingHorizontal: 14,
          paddingVertical: 6,
          borderRadius: 999
        }}
      >
        <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>Listo</Text>
      </Pressable>
    </View>
  );
}
