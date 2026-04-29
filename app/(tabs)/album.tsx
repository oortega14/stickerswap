import { useState } from "react";
import { View, Text, FlatList, Pressable, TextInput } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { StarryBackground } from "@/ui/StarryBackground";
import { FilterChip } from "@/ui/FilterChip";
import { useStickerList, useIncrement, useDecrement } from "@/hooks/useStickers";
import { useFilters } from "@/store/filters";
import type { StickerWithStatus } from "@/domain/types";
import { colors } from "@/theme/colors";

const COLUMNS = 4;

function StickerCell({ s, onTap, onLong }: {
  s: StickerWithStatus;
  onTap: () => void;
  onLong: () => void;
}) {
  const collected = s.count >= 1;
  return (
    <Pressable
      onPress={onTap}
      onLongPress={onLong}
      delayLongPress={350}
      className="flex-1 m-1"
    >
      <View
        className="aspect-square rounded-md items-center justify-center"
        style={{
          backgroundColor: collected ? colors.purple : colors.dark,
          borderWidth: collected ? 0 : 1,
          borderColor: "rgba(124,92,255,0.25)",
          borderStyle: collected ? "solid" : "dashed"
        }}
      >
        <Text
          className="font-bold"
          style={{
            color: collected ? "#fff" : colors.dim,
            fontSize: 12
          }}
        >
          {s.number}
        </Text>
        {s.count > 1 && (
          <View
            className="absolute -bottom-1 -right-1 rounded-full items-center justify-center"
            style={{ width: 18, height: 18, backgroundColor: colors.blue }}
          >
            <Text className="text-white font-bold" style={{ fontSize: 10 }}>
              {s.count}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function AlbumScreen() {
  const router = useRouter();
  const { query, mode, setQuery, setMode } = useFilters();
  const { data, isLoading } = useStickerList(query, mode);
  const inc = useIncrement();
  const dec = useDecrement();
  const [showSearch, setShowSearch] = useState(false);

  return (
    <StarryBackground>
      <View className="flex-1 px-3 pt-14">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-space-violet font-bold tracking-widest text-sm">
            ÁLBUM · MUNDIAL 2026
          </Text>
          <Pressable onPress={() => setShowSearch((v) => !v)} className="p-2">
            <Text className="text-space-violet text-lg">⌕</Text>
          </Pressable>
        </View>

        {showSearch && (
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por número, jugador o equipo"
            placeholderTextColor={colors.dim}
            className="bg-space-dark text-space-ink rounded-lg px-3 py-2 mb-3"
            autoCorrect={false}
          />
        )}

        <View className="flex-row gap-2 mb-3">
          <FilterChip label="Todos" active={mode === "all"} onPress={() => setMode("all")} />
          <FilterChip label="Faltan" active={mode === "missing"} onPress={() => setMode("missing")} />
          <FilterChip label="Repetidas" active={mode === "duplicates"} onPress={() => setMode("duplicates")} />
        </View>

        {isLoading ? (
          <Text className="text-space-mute text-center mt-8">Cargando…</Text>
        ) : (
          <FlatList
            data={data ?? []}
            keyExtractor={(item) => item.code}
            numColumns={COLUMNS}
            renderItem={({ item }) => (
              <StickerCell
                s={item}
                onTap={async () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  inc.mutate(item.code);
                }}
                onLong={async () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  dec.mutate(item.code);
                }}
              />
            )}
            ListEmptyComponent={
              <Text className="text-space-mute text-center mt-8">Sin resultados.</Text>
            }
          />
        )}

        <Pressable
          onPress={() => router.push("/sticker/INTRO-1")}
          className="absolute bottom-6 right-6 bg-space-purple rounded-full px-4 py-2"
        >
          <Text className="text-white text-xs">Demo detalle</Text>
        </Pressable>
      </View>
    </StarryBackground>
  );
}
