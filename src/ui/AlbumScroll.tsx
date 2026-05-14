import { memo, useCallback, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FlashList, type FlashListRef, type ViewToken } from "@shopify/flash-list";
import { ProgressBar } from "./ProgressBar";
import { StickerCardVisual } from "./StickerCardVisual";
import {
  useAlbumStickers,
  useIncrement,
  useDecrement,
  useBulkMarkTeam
} from "@/hooks/useStickers";
import { haptics } from "@/lib/haptics";
import { getTeamColors, type TeamColors } from "@/theme/teamColors";
import { getTeamFlag } from "@/theme/teamFlags";
import { getTeamGroup } from "@/theme/teamGroups";
import { useTheme } from "@/theme/ThemeProvider";
import { withAlpha } from "@/theme/colors";
import { findSectionIndex, type AlbumSection } from "@/domain/albumOrder";
import type { StickerWithStatus } from "@/domain/types";

const STICKERS_PER_ROW = 3;

type Row =
  | { kind: "header"; section: AlbumSection<StickerWithStatus> }
  | {
      kind: "stickerRow";
      section: AlbumSection<StickerWithStatus>;
      stickers: StickerWithStatus[];
      rowIndex: number;
    };

// Color "neutral" en bandera (blanco/negro) que no comunica identidad si lo
// usamos como acento; el helper elige el siguiente más representativo.
function pickTint(c: TeamColors): string {
  const isNeutral = (h: string) => /^#(fff|ffffff|000|000000)$/i.test(h);
  if (!isNeutral(c.bg)) return c.bg;
  if (!isNeutral(c.surface)) return c.surface;
  return c.accent;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function AlbumScroll({ startId }: { startId: string }) {
  const { data, isLoading } = useAlbumStickers();
  const inc = useIncrement();
  const dec = useDecrement();
  const bulkMark = useBulkMarkTeam();
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const listRef = useRef<FlashListRef<Row>>(null);
  const visibleIdRef = useRef<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const { rows, headerIndices, initialIndex } = useMemo(() => {
    if (!data) {
      return {
        rows: [] as Row[],
        headerIndices: new Map<string, number>(),
        initialIndex: 0
      };
    }
    const flat: Row[] = [];
    const headerIdx = new Map<string, number>();
    for (const section of data) {
      headerIdx.set(section.id, flat.length);
      flat.push({ kind: "header", section });
      for (const [rowIndex, stickers] of chunk(section.stickers, STICKERS_PER_ROW).entries()) {
        flat.push({ kind: "stickerRow", section, stickers, rowIndex });
      }
    }
    const startIdx = findSectionIndex(data, startId);
    const startSection = startIdx >= 0 ? data[startIdx] : null;
    const initial = startSection ? headerIdx.get(startSection.id) ?? 0 : 0;
    return { rows: flat, headerIndices: headerIdx, initialIndex: initial };
  }, [data, startId]);

  const onViewable = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<Row>[] }) => {
      if (viewableItems.length === 0) return;
      const first = viewableItems[0];
      if (!first.item) return;
      const newId = first.item.section.id;
      if (newId !== visibleIdRef.current) {
        visibleIdRef.current = newId;
        router.setParams({ id: newId });
      }
      const headerIdx = headerIndices.get(newId);
      const currentIdx = first.index ?? -1;
      setShowBackToTop(headerIdx !== undefined && currentIdx > headerIdx);
    },
    [router, headerIndices]
  );

  const viewabilityConfigCallbackPairs = useRef([
    {
      viewabilityConfig: { itemVisiblePercentThreshold: 30 },
      onViewableItemsChanged: onViewable
    }
  ]);

  const scrollToCurrentSection = useCallback(() => {
    const id = visibleIdRef.current;
    if (!id) return;
    const idx = headerIndices.get(id);
    if (idx === undefined) return;
    listRef.current?.scrollToIndex({ index: idx, animated: true });
  }, [headerIndices]);

  const handleTap = useCallback(
    (code: string) => {
      haptics.light();
      inc.mutate(code);
    },
    [inc]
  );
  const handleLong = useCallback(
    (code: string) => {
      haptics.medium();
      dec.mutate(code);
    },
    [dec]
  );
  const handleBulkMark = useCallback(
    (teamCode: string) => {
      haptics.medium();
      bulkMark.mutate(teamCode);
    },
    [bulkMark]
  );

  const renderItem = useCallback(
    ({ item }: { item: Row }) => {
      if (item.kind === "header") {
        return (
          <SectionHeader
            section={item.section}
            bulkMarkPending={bulkMark.isPending && bulkMark.variables === item.section.teamCode}
            onBulkMark={handleBulkMark}
          />
        );
      }
      const accent = item.section.teamCode
        ? pickTint(getTeamColors(item.section.teamCode))
        : theme.accent;
      return (
        <View style={{ flexDirection: "row", paddingHorizontal: 12 }}>
          {item.stickers.map((s) => (
            <StickerCard
              key={s.code}
              s={s}
              accent={accent}
              onTap={handleTap}
              onLong={handleLong}
            />
          ))}
          {Array.from({ length: STICKERS_PER_ROW - item.stickers.length }).map((_, i) => (
            <View key={`fill-${i}`} style={{ width: "33.333%" }} />
          ))}
        </View>
      );
    },
    [bulkMark.isPending, bulkMark.variables, handleBulkMark, handleTap, handleLong, theme.accent]
  );

  if (isLoading || !data) {
    return (
      <View
        style={{ flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center" }}
      >
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <FlashList<Row>
        ref={listRef}
        data={rows}
        renderItem={renderItem}
        keyExtractor={(item) =>
          item.kind === "header"
            ? `h-${item.section.id}`
            : `r-${item.section.id}-${item.rowIndex}`
        }
        getItemType={(item) => item.kind}
        initialScrollIndex={initialIndex}
        contentContainerStyle={{
          paddingTop: insets.top + 64,
          paddingBottom: insets.bottom + 24
        }}
        viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
      />

      {/* Back button siempre visible arriba a la izquierda */}
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Volver"
        style={{
          position: "absolute",
          top: insets.top + 12,
          left: 16,
          zIndex: 20,
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: theme.card,
          borderColor: theme.border,
          borderWidth: 1,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: theme.text,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.12,
          shadowRadius: 4,
          elevation: 3
        }}
      >
        <Text style={{ color: theme.text, fontSize: 18 }}>‹</Text>
      </Pressable>

      {/* Botón flotante "volver arriba" — al inicio de la sección actual */}
      {showBackToTop && (
        <Pressable
          onPress={scrollToCurrentSection}
          accessibilityRole="button"
          accessibilityLabel="Volver al inicio de esta sección"
          style={{
            position: "absolute",
            bottom: insets.bottom + 16,
            alignSelf: "center",
            backgroundColor: theme.card,
            borderColor: theme.border,
            borderWidth: 1,
            borderRadius: 999,
            paddingVertical: 10,
            paddingHorizontal: 16,
            flexDirection: "row",
            alignItems: "center",
            shadowColor: theme.text,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.18,
            shadowRadius: 10,
            elevation: 6
          }}
        >
          <Text style={{ color: theme.text, fontSize: 13, marginRight: 6 }}>↑</Text>
          <Text style={{ color: theme.text, fontSize: 13, fontWeight: "700" }}>
            Volver arriba
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function SectionHeader({
  section,
  bulkMarkPending,
  onBulkMark
}: {
  section: AlbumSection<StickerWithStatus>;
  bulkMarkPending: boolean;
  onBulkMark: (teamCode: string) => void;
}) {
  const { theme } = useTheme();
  const tint = section.teamCode ? pickTint(getTeamColors(section.teamCode)) : theme.accent;
  const flag = section.teamCode ? getTeamFlag(section.teamCode) : "✦";
  const group = section.teamCode ? getTeamGroup(section.teamCode) : null;
  const chipLabel = group ? `GRUPO ${group}` : "ESPECIAL";

  const total = section.stickers.length;
  const collected = section.stickers.filter((s) => s.count >= 1).length;
  const duplicates = section.stickers.reduce(
    (acc, s) => acc + (s.count > 1 ? s.count - 1 : 0),
    0
  );
  const pct = total === 0 ? 0 : collected / total;

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 32, paddingBottom: 14 }}>
      {/* Chip de grupo / sección — reemplaza la barrita que se confundía con la progress bar */}
      <View
        style={{
          alignSelf: "flex-start",
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: withAlpha(tint, 0.16),
          borderColor: withAlpha(tint, 0.4),
          borderWidth: 1,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          marginBottom: 12
        }}
      >
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: tint,
            marginRight: 6
          }}
        />
        <Text style={{ color: tint, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>
          {chipLabel}
        </Text>
      </View>

      <View className="flex-row items-center mb-1">
        <Text style={{ fontSize: 32, marginRight: 10 }}>{flag}</Text>
        <View className="flex-1">
          <Text style={{ color: theme.text, fontSize: 24, fontWeight: "800" }}>
            {section.name}
          </Text>
          <Text style={{ color: theme.textMute, fontSize: 12, marginTop: 2 }}>
            {collected}/{total}
            {duplicates > 0 ? ` · ${duplicates} repes` : ""}
          </Text>
        </View>
      </View>

      <View className="mt-3">
        <ProgressBar pct={pct} height={3} from={tint} to={tint} />
      </View>

      {section.type === "team" && section.teamCode && (
        <Pressable
          onPress={() => onBulkMark(section.teamCode!)}
          disabled={bulkMarkPending}
          accessibilityRole="button"
          accessibilityLabel={`Marcar todo ${section.name} como pegado`}
          style={{
            marginTop: 14,
            backgroundColor: tint,
            paddingVertical: 11,
            paddingHorizontal: 16,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            opacity: bulkMarkPending ? 0.6 : 1
          }}
        >
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>
            ✓  Pegar equipo entero
          </Text>
        </Pressable>
      )}
    </View>
  );
}

interface StickerCardProps {
  s: StickerWithStatus;
  accent: string;
  onTap: (code: string) => void;
  onLong: (code: string) => void;
}

function StickerCardImpl({ s, accent, onTap, onLong }: StickerCardProps) {
  const { theme } = useTheme();
  const collected = s.count >= 1;
  const handlePress = useCallback(() => onTap(s.code), [onTap, s.code]);
  const handleLong = useCallback(() => onLong(s.code), [onLong, s.code]);

  return (
    <View style={{ width: "33.333%", padding: 4 }}>
      <Pressable
        onPress={handlePress}
        onLongPress={handleLong}
        delayLongPress={350}
        accessibilityRole="button"
        accessibilityLabel={`${collected ? "Pegado" : "Falta"}: ${s.name}. Toca para sumar, mantén para restar.`}
        style={{
          borderRadius: 12,
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: collected ? withAlpha(accent, 0.5) : theme.border,
          overflow: "hidden",
          shadowColor: theme.text,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 3,
          elevation: 1
        }}
      >
        <View
          style={{
            aspectRatio: 1,
            backgroundColor: collected ? withAlpha(accent, 0.12) : theme.bg,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <View style={{ width: "78%", height: "78%" }}>
            <StickerCardVisual
              sticker={s}
              cardBgColor={collected ? withAlpha(accent, 0.12) : theme.bg}
            />
          </View>
          {collected && (
            <View
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                minWidth: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: accent,
                paddingHorizontal: 6,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Text style={{ color: "#ffffff", fontSize: 11, fontWeight: "700" }}>
                {s.count > 1 ? `×${s.count}` : "✓"}
              </Text>
            </View>
          )}
        </View>

        <View style={{ padding: 8 }}>
          <Text style={{ color: accent, fontSize: 11, fontWeight: "700" }}>
            #{s.code}
          </Text>
          <Text
            style={{ color: theme.text, fontSize: 12, fontWeight: "600", marginTop: 2 }}
            numberOfLines={1}
          >
            {s.name}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

/**
 * Memoizado: FlashList recicla muy seguido durante scroll, y cada card
 * adentro tiene un SVG caro. Solo re-renderizamos cuando cambia el code
 * del sticker, su count (afecta el badge) o el accent del equipo.
 */
const StickerCard = memo(
  StickerCardImpl,
  (prev, next) =>
    prev.s.code === next.s.code &&
    prev.s.count === next.s.count &&
    prev.accent === next.accent &&
    prev.onTap === next.onTap &&
    prev.onLong === next.onLong
);
