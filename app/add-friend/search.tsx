import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { GlowCard } from "@/ui/GlowCard";
import { useFindUser } from "@/hooks/useFindUser";
import { requestFriendByUsername } from "@/social/friendships";
import { useTheme } from "@/theme/ThemeProvider";

export default function SearchFriend() {
  const router = useRouter();
  const { theme } = useTheme();
  const [q, setQ] = useState("");
  const find = useFindUser();
  const [result, setResult] = useState<typeof find.data>(undefined);

  useEffect(() => {
    if (q.length < 3) {
      setResult(undefined);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await find.mutateAsync(q.toLowerCase());
        setResult(r);
      } catch {
        setResult(null);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  const onAdd = async () => {
    if (!result) return;
    try {
      await requestFriendByUsername(result.id);
      Alert.alert("Solicitud enviada", `Le enviaste solicitud a @${result.username}.`, [
        { text: "OK", onPress: () => router.back() }
      ]);
    } catch (e) {
      Alert.alert("Error", String((e as Error).message ?? e));
    }
  };

  return (
    <ThemedBackground>
      <View className="flex-1 px-4 pt-14">
        <Text className="text-space-violet font-bold tracking-widest text-sm mb-4">
          BUSCAR AMIGO
        </Text>
        <GlowCard className="mb-4">
          <Text className="text-space-mute text-xs mb-1">@username</Text>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="oscar_panini"
            placeholderTextColor={theme.textMute}
            autoCapitalize="none"
            autoCorrect={false}
            className="text-space-ink text-base bg-space-mid rounded-md px-3 py-2"
            maxLength={20}
          />
        </GlowCard>

        {find.isPending ? (
          <ActivityIndicator color={theme.accent} />
        ) : result ? (
          <GlowCard>
            <Text className="text-space-ink text-base font-bold">
              {result.display_name ?? result.username}
            </Text>
            <Text className="text-space-mute text-sm mb-3">@{result.username}</Text>
            <Pressable
              onPress={onAdd}
              className="bg-space-purple rounded-lg py-2 items-center"
              accessibilityLabel="Enviar solicitud"
              accessibilityRole="button"
            >
              <Text className="text-white font-semibold">Enviar solicitud</Text>
            </Pressable>
          </GlowCard>
        ) : result === null ? (
          <Text className="text-space-mute text-center">No encontramos a nadie con ese username.</Text>
        ) : null}
      </View>
    </ThemedBackground>
  );
}
