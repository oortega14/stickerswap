import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { View, Text, Pressable } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { Skeleton } from "@/ui/Skeleton";
import { DashboardGrid } from "@/ui/dashboard/DashboardGrid";
import { ViewModeToggle } from "@/ui/album/ViewModeToggle";
import { SectionCollapsible } from "@/ui/album/SectionCollapsible";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useAlbumStickers } from "@/hooks/useStickers";
import { useStickerViewMode } from "@/store/stickerViewMode";
import { useExpandedSections } from "@/store/expandedSections";
import { useFilterMode } from "@/store/filterMode";
import { useTheme } from "@/theme/ThemeProvider";
import type { AlbumSection } from "@/domain/albumOrder";
import type { StickerWithStatus } from "@/domain/types";

export default function Home() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, mode, setMode } = useTheme();
  const dashboard = useDashboardStats();
  const album = useAlbumStickers();
  const viewMode = useStickerViewMode((s) => s.mode);
  const setViewMode = useStickerViewMode((s) => s.setMode);

  const expanded = useExpandedSections((s) => s.expanded);
  const toggleSection = useExpandedSections((s) => s.toggle);

  // Suscribirse al state `filters` (no a `getFilter`, que es referencia
  // estable y no dispara re-render al cambiar).
  const filters = useFilterMode((s) => s.filters);
  const setFilter = useFilterMode((s) => s.setFilter);

  // Deep link: /?expand=ARG
  const params = useLocalSearchParams<{ expand?: string }>();
  const listRef = useRef<FlashListRef<AlbumSection<StickerWithStatus>>>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!params.expand || !album.data) return;
    const idx = album.data.findIndex((s) => s.id === params.expand);
    if (idx >= 0) {
      const id = album.data[idx].id;
      if (!expanded.has(id)) toggleSection(id);
      listRef.current?.scrollToIndex({ index: idx, animated: true });
    }
  }, [params.expand, album.data]);

  const sections = useMemo(() => album.data ?? [], [album.data]);

  const renderHeader = useCallback(
    () => (
      <View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12
          }}
        >
          <Text style={{ color: theme.text, fontSize: 28, fontWeight: "800" }}>Mi Album</Text>
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
            <Text style={{ color: theme.text, fontSize: 16 }}>
              {mode === "dark" ? "☾" : "☀"}
            </Text>
          </Pressable>
        </View>

        {dashboard.stats ? (
          <DashboardGrid stats={dashboard.stats} />
        ) : (
          <View>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} style={{ height: 60, marginBottom: 8 }} />
            ))}
          </View>
        )}

        <ViewModeToggle mode={viewMode} onChange={setViewMode} />
      </View>
    ),
    [theme, mode, setMode, dashboard.stats, viewMode, setViewMode]
  );

  if (album.isLoading || sections.length === 0) {
    return (
      <ThemedBackground>
        <View
          style={{
            paddingTop: insets.top + 12,
            paddingHorizontal: 16,
            paddingBottom: tabBarHeight + 12
          }}
        >
          {renderHeader()}
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 60, marginBottom: 8 }} />
          ))}
        </View>
      </ThemedBackground>
    );
  }

  return (
    <ThemedBackground>
      <FlashList
        ref={listRef}
        data={sections}
        keyExtractor={(s) => s.id}
        ListHeaderComponent={renderHeader}
        renderItem={({ item }) => (
          <SectionCollapsible
            section={item}
            expanded={expanded.has(item.id)}
            filterMode={filters[item.id] ?? "all"}
            viewMode={viewMode}
            onToggle={() => toggleSection(item.id)}
            onChangeFilter={(m) => setFilter(item.id, m)}
          />
        )}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 16,
          paddingBottom: tabBarHeight + 24
        }}
      />
    </ThemedBackground>
  );
}
