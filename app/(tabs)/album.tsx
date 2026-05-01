import { useState } from "react";
import { View, Text, FlatList, Pressable, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { haptics } from "@/lib/haptics";
import { StarryBackground } from "@/ui/StarryBackground";
import { FilterChip } from "@/ui/FilterChip";
import { AnimatedStickerCell } from "@/ui/AnimatedStickerCell";
import { SkeletonAlbumGrid } from "@/ui/SkeletonAlbumGrid";
import { EmptyState } from "@/ui/EmptyState";
import { useStickerList, useIncrement, useDecrement } from "@/hooks/useStickers";
import { useFilters } from "@/store/filters";
import { colors } from "@/theme/colors";

const COLUMNS = 4;

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
          <Pressable
            onPress={() => setShowSearch((v) => !v)}
            className="p-2"
            accessibilityLabel="Buscar"
            accessibilityRole="button"
          >
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
          <SkeletonAlbumGrid />
        ) : (
          <FlatList
            data={data ?? []}
            keyExtractor={(item) => item.code}
            numColumns={COLUMNS}
            renderItem={({ item }) => (
              <AnimatedStickerCell
                s={item}
                onTap={() => {
                  haptics.light();
                  inc.mutate(item.code);
                }}
                onLong={() => {
                  haptics.medium();
                  dec.mutate(item.code);
                }}
                onInfo={() => router.push(`/sticker/${item.code}`)}
              />
            )}
            ListEmptyComponent={
              <EmptyState variant="stars" title="Sin resultados" message="Cambiá el filtro o el término de búsqueda." />
            }
          />
        )}
      </View>
    </StarryBackground>
  );
}
