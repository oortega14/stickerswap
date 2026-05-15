import { useState } from "react";
import { Pressable, Text } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { AddFriendPicker } from "./AddFriendPicker";

export function AddFriendChip() {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Agregar amigo"
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: theme.card,
          borderColor: theme.border,
          borderWidth: 1,
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 10
        }}
      >
        <Text style={{ color: theme.text, fontSize: 14, fontWeight: "700" }}>+ Agregar</Text>
      </Pressable>
      <AddFriendPicker visible={open} onClose={() => setOpen(false)} />
    </>
  );
}
