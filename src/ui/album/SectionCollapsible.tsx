import React, { useMemo } from "react";
import { View, Pressable, Text } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition
} from "react-native-reanimated";
import { useTheme } from "@/theme/ThemeProvider";
import { ProgressBar } from "@/ui/ProgressBar";
import { FlagSvg } from "@/ui/flags/FlagSvg";
import { FilterChips } from "./FilterChips";
import { StickerBolita } from "./StickerBolita";
import { StickerFullCard } from "./StickerFullCard";
import { filterStickers, countByFilter, type FilterMode } from "@/domain/stickerFilter";
import { haptics } from "@/lib/haptics";
import { getTeamColors } from "@/theme/teamColors";
import type { StickerViewMode } from "@/store/stickerViewMode";
import type { StickerWithStatus } from "@/domain/types";
import type { AlbumSection } from "@/domain/albumOrder";

interface Props {
  section: AlbumSection<StickerWithStatus>;
  expanded: boolean;
  filterMode: FilterMode;
  viewMode: StickerViewMode;
  onToggle: () => void;
  onChangeFilter: (mode: FilterMode) => void;
}

export function SectionCollapsible({
  section,
  expanded,
  filterMode,
  viewMode,
  onToggle,
  onChangeFilter
}: Props) {
  const { theme } = useTheme();

  const teamColors = section.teamCode ? getTeamColors(section.teamCode) : null;
  const bandColor = teamColors?.bg ?? theme.accent;

  const counts = useMemo(() => countByFilter(section.stickers), [section.stickers]);
  const filtered = useMemo(
    () => filterStickers(section.stickers, filterMode),
    [section.stickers, filterMode]
  );

  const collected = counts.all - counts.missing;

  return (
    <Animated.View
      style={{ marginBottom: 8 }}
      layout={LinearTransition.duration(220)}
    >
      <Pressable
        onPress={() => {
          haptics.light();
          onToggle();
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${section.name}, ${collected} de ${counts.all}, ${
          expanded ? "expandido" : "colapsado"
        }`}
        style={{
          flexDirection: "row",
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: theme.border,
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
          borderBottomLeftRadius: expanded ? 0 : 10,
          borderBottomRightRadius: expanded ? 0 : 10,
          overflow: "hidden",
          alignItems: "center"
        }}
      >
        <View style={{ width: 5, height: 48, backgroundColor: bandColor }} />
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            overflow: "hidden",
            marginHorizontal: 10
          }}
        >
          <FlagSvg code={section.teamCode} section={section.name} />
        </View>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={{ color: theme.text, fontSize: 14, fontWeight: "700" }} numberOfLines={1}>
            {section.name}
          </Text>
          <View style={{ marginTop: 4 }}>
            <ProgressBar pct={counts.all === 0 ? 0 : collected / counts.all} height={2} from={bandColor} to={bandColor} />
          </View>
        </View>
        <Text style={{ color: theme.textMute, fontSize: 12, marginRight: 12 }}>
          {collected}/{counts.all} {expanded ? "⌄" : "›"}
        </Text>
      </Pressable>

      {expanded && (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(140)}
          style={{
            backgroundColor: theme.card,
            borderWidth: 1,
            borderTopWidth: 0,
            borderColor: theme.border,
            borderBottomLeftRadius: 10,
            borderBottomRightRadius: 10,
            padding: 10,
            overflow: "hidden"
          }}
        >
          <FilterChips counts={counts} active={filterMode} onChange={onChangeFilter} />

          {filtered.length === 0 ? (
            <Text
              style={{
                color: theme.textMute,
                fontSize: 13,
                textAlign: "center",
                paddingVertical: 12
              }}
            >
              {filterMode === "missing"
                ? "¡Sin faltantes! Equipo completo."
                : filterMode === "dup"
                ? "Sin repes de este equipo."
                : "No hay cromos para mostrar."}
            </Text>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5 }}>
              {filtered.map((s) =>
                viewMode === "compact" ? (
                  <StickerBolita key={s.code} sticker={s} teamCode={section.teamCode} />
                ) : (
                  <StickerFullCard key={s.code} sticker={s} teamCode={section.teamCode} />
                )
              )}
            </View>
          )}
        </Animated.View>
      )}
    </Animated.View>
  );
}
