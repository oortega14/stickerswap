import { Pressable, Text, ActivityIndicator } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
}

/**
 * Botón primario theme-aware. Garantiza alto contraste en light + dark:
 * usa theme.text (color con mayor contraste contra el fondo) como bg
 * y theme.bg como color de texto.
 */
export function PrimaryButton({ label, onPress, disabled, loading, accessibilityLabel }: Props) {
  const { theme } = useTheme();
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={{
        backgroundColor: theme.text,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
        justifyContent: "center",
        opacity: isDisabled ? 0.5 : 1
      }}
    >
      {loading ? (
        <ActivityIndicator color={theme.bg} />
      ) : (
        <Text style={{ color: theme.bg, fontSize: 16, fontWeight: "700" }}>{label}</Text>
      )}
    </Pressable>
  );
}
