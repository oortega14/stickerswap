import React, { useMemo } from "react";
import { View, Pressable, Text } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { ProgressBar } from "@/ui/ProgressBar";
import { FlagSvg } from "@/ui/flags/FlagSvg";
import { showSnackbar } from "@/ui/Snackbar";
import { FilterChips } from "./FilterChips";
import { StickerBolita } from "./StickerBolita";
import { StickerFullCard } from "./StickerFullCard";
import { filterStickers, countByFilter, type FilterMode } from "@/domain/stickerFilter";
import { haptics } from "@/lib/haptics";
import { useBulkMarkTeam } from "@/hooks/useStickers";
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
  const bulkMark = useBulkMarkTeam();

  const teamColors = section.teamCode ? getTeamColors(section.teamCode) : null;
  const bandColor = teamColors?.bg ?? theme.accent;

  const counts = useMemo(() => countByFilter(section.stickers), [section.stickers]);
  const filtered = useMemo(
    () => filterStickers(section.stickers, filterMode),
    [section.stickers, filterMode]
  );

  const collected = counts.all - counts.missing;
  // "Pegar todo" solo cuando hay equipo (teamCode != null) y todavia
  // faltan cromos por marcar. Intro/Extras/Coca-Cola se omiten porque no
  // son "equipos" — el flujo de marcado masivo de coleccionista no aplica.
  const canBulkMark = section.teamCode != null && counts.missing > 0;
  const handleBulkMark = () => {
    if (!section.teamCode) return;
    haptics.success();
    bulkMark.mutate(section.teamCode, {
      onSuccess: (count) => {
        showSnackbar(`Pegadas ${count} laminas de ${section.name}`);
      }
    });
  };

  return (
    <View style={{ marginBottom: 8 }}>
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
          alignItems: "center",
          paddingVertical: 10
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: bandColor,
            opacity: 0.08
          }}
        />
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            overflow: "hidden",
            marginLeft: 12,
            marginRight: 10
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
        <View
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
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: bandColor,
              opacity: 0.08
            }}
          />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap" }}>
              <FilterChips counts={counts} active={filterMode} onChange={onChangeFilter} />
            </View>
            {canBulkMark && (
              <Pressable
                onPress={handleBulkMark}
                disabled={bulkMark.isPending}
                accessibilityRole="button"
                accessibilityLabel={`Pegar todas las laminas faltantes de ${section.name}`}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: theme.accent,
                  opacity: bulkMark.isPending ? 0.6 : 1
                }}
              >
                <Text style={{ color: theme.bg, fontSize: 11, fontWeight: "700" }}>
                  ✓ Pegar todo
                </Text>
              </Pressable>
            )}
          </View>

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
        </View>
      )}
    </View>
  );
}
