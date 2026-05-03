import { useMemo } from "react";
import { ScrollView, View, Text, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ProgressBar } from "@/ui/ProgressBar";
import { useTeamStickers, useIncrement, useDecrement } from "@/hooks/useStickers";
import { haptics } from "@/lib/haptics";
import { getTeamColors } from "@/theme/teamColors";
import { withAlpha, tonalShift } from "@/theme/colors";
import type { StickerWithStatus } from "@/domain/types";

export default function TeamDetail() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { data, isLoading } = useTeamStickers(code ?? "");
  const inc = useIncrement();
  const dec = useDecrement();

  const colors = useMemo(() => getTeamColors(code), [code]);
  const pegadaBg = useMemo(() => tonalShift(colors.primary, colors.text), [colors]);

  const summary = useMemo(() => {
    if (!data) return null;
    const total = data.length;
    const collected = data.filter((s) => s.count >= 1).length;
    const duplicates = data.reduce((acc, s) => acc + (s.count > 1 ? s.count - 1 : 0), 0);
    return { total, collected, duplicates, pct: total === 0 ? 0 : collected / total };
  }, [data]);

  const teamName = data?.[0]?.section ?? code ?? "";
  const badge = data?.find((s) => s.type === "team_badge");
  const teamPhoto = data?.find((s) => s.type === "team_photo");
  const players = data?.filter((s) => s.type === "player") ?? [];

  if (isLoading || !data || !summary) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.primary }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header solid primary */}
        <View style={{ paddingTop: 56, paddingBottom: 24, paddingHorizontal: 16 }}>
          <Pressable onPress={() => router.back()} accessibilityLabel="Volver" accessibilityRole="button">
            <Text style={{ color: colors.text, opacity: 0.85, marginBottom: 12 }}>‹ Volver</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: "800" }}>{teamName}</Text>
          <Text style={{ color: colors.text, opacity: 0.75, fontSize: 12, letterSpacing: 1, marginTop: 4 }}>
            {code}
          </Text>
          <View className="mt-4">
            <Text style={{ color: colors.text, opacity: 0.75, fontSize: 11, letterSpacing: 2 }}>PROGRESO</Text>
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: "700", marginTop: 2 }}>
              {summary.collected} / {summary.total}
            </Text>
            <View className="mt-2">
              <ProgressBar pct={summary.pct} from={pegadaBg} to={colors.accent} />
            </View>
            <Text style={{ color: colors.text, opacity: 0.7, fontSize: 11, marginTop: 6 }}>
              {summary.duplicates > 0 ? `${summary.duplicates} repetidas` : "Sin repetidas"}
            </Text>
          </View>
        </View>

        {/* Body */}
        <View className="px-4">
          {/* Escudo + team_photo en una fila */}
          {(badge || teamPhoto) && (
            <View className="flex-row gap-2 mb-4">
              {badge && (
                <SpecialCard
                  s={badge}
                  label="ESCUDO"
                  inc={inc}
                  dec={dec}
                  pegadaBg={pegadaBg}
                  text={colors.text}
                />
              )}
              {teamPhoto && (
                <SpecialCard
                  s={teamPhoto}
                  label="PLANTEL"
                  inc={inc}
                  dec={dec}
                  pegadaBg={pegadaBg}
                  text={colors.text}
                />
              )}
            </View>
          )}

          {/* Lista de jugadores */}
          <Text
            className="text-xs tracking-widest mb-2"
            style={{ color: colors.accent }}
          >
            JUGADORES ({players.length})
          </Text>
          {players.map((s) => (
            <PlayerRow
              key={s.code}
              s={s}
              pegadaBg={pegadaBg}
              accent={colors.accent}
              primary={colors.primary}
              text={colors.text}
              onTap={() => {
                haptics.light();
                inc.mutate(s.code);
              }}
              onLong={() => {
                haptics.medium();
                dec.mutate(s.code);
              }}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function SpecialCard({
  s,
  label,
  inc,
  dec,
  pegadaBg,
  text
}: {
  s: StickerWithStatus;
  label: string;
  inc: ReturnType<typeof useIncrement>;
  dec: ReturnType<typeof useDecrement>;
  pegadaBg: string;
  text: string;
}) {
  const collected = s.count >= 1;
  return (
    <Pressable
      onPress={() => {
        haptics.light();
        inc.mutate(s.code);
      }}
      onLongPress={() => {
        haptics.medium();
        dec.mutate(s.code);
      }}
      delayLongPress={350}
      accessibilityLabel={`${label} ${s.name}`}
      accessibilityRole="button"
      className="flex-1 rounded-xl p-3"
      style={{
        backgroundColor: collected ? pegadaBg : "transparent",
        borderWidth: 1,
        borderColor: collected ? pegadaBg : withAlpha(text, 0.25)
      }}
    >
      <Text
        className="text-xs tracking-widest"
        style={{ color: text, opacity: collected ? 0.85 : 0.7 }}
      >
        {s.code} · {label}
      </Text>
      <Text
        className="text-base font-semibold mt-1"
        style={{ color: text, opacity: collected ? 1 : 0.9 }}
      >
        {s.name}
      </Text>
      {s.count > 1 && (
        <Text
          className="text-xs mt-1"
          style={{ color: text, opacity: 0.7 }}
        >
          ×{s.count}
        </Text>
      )}
    </Pressable>
  );
}

function PlayerRow({
  s,
  pegadaBg,
  accent,
  primary,
  text,
  onTap,
  onLong
}: {
  s: StickerWithStatus;
  pegadaBg: string;
  accent: string;
  primary: string;
  text: string;
  onTap: () => void;
  onLong: () => void;
}) {
  const collected = s.count >= 1;
  return (
    <Pressable
      onPress={onTap}
      onLongPress={onLong}
      delayLongPress={350}
      accessibilityLabel={`${collected ? "Pegado" : "Falta"}: ${s.name}`}
      accessibilityRole="button"
      className="flex-row items-center justify-between rounded-lg mb-2 px-3 py-3"
      style={{
        backgroundColor: collected ? pegadaBg : "transparent",
        borderWidth: 1,
        borderColor: collected ? pegadaBg : withAlpha(text, 0.25)
      }}
    >
      <View className="flex-row items-center flex-1">
        <Text
          className="font-mono text-xs mr-3"
          style={{
            color: text,
            opacity: collected ? 0.7 : 0.6,
            minWidth: 56
          }}
        >
          {s.code}
        </Text>
        <Text
          className="text-base font-semibold flex-1"
          style={{ color: text, opacity: collected ? 1 : 0.85 }}
        >
          {s.name}
        </Text>
      </View>
      {s.count > 1 ? (
        <View
          className="rounded-full px-2 py-0.5 ml-2"
          style={{ backgroundColor: text }}
        >
          <Text className="text-xs font-bold" style={{ color: primary }}>×{s.count}</Text>
        </View>
      ) : collected ? (
        <Text className="text-xs ml-2" style={{ color: accent }}>✓</Text>
      ) : (
        <Text className="text-xs ml-2" style={{ color: text, opacity: 0.4 }}>·</Text>
      )}
    </Pressable>
  );
}
