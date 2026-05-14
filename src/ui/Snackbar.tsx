import { useEffect, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";

type Listener = (msg: string) => void;
let listener: Listener | null = null;

export function showSnackbar(msg: string) {
  if (listener) listener(msg);
}

export function Snackbar() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    listener = (incoming: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMsg(incoming);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(
          () => setMsg(null)
        );
      }, 3000);
    };
    return () => {
      listener = null;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [opacity]);

  if (!msg) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: insets.top + 16,
        left: 16,
        right: 16,
        opacity,
        zIndex: 9999
      }}
    >
      <View
        style={{
          backgroundColor: theme.card,
          borderColor: theme.border,
          borderWidth: 1,
          borderRadius: 10,
          paddingVertical: 10,
          paddingHorizontal: 14,
          shadowColor: theme.text,
          shadowOpacity: 0.1,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3
        }}
      >
        <Text style={{ color: theme.text, fontSize: 14 }}>{msg}</Text>
      </View>
    </Animated.View>
  );
}
