import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { DashboardHero } from "./DashboardHero";
import { StatCard } from "./StatCard";
import type { DashboardStats } from "@/domain/stats";

interface Props {
  stats: DashboardStats;
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(ms).toLocaleDateString("es", { day: "numeric", month: "short" });
}

export function DashboardGrid({ stats }: Props) {
  const router = useRouter();

  const lastAddedValue = stats.lastAdded ? formatRelative(stats.lastAdded.updatedAt) : "—";
  const lastAddedSub = stats.lastAdded?.stickerCode ?? "Sin actividad";

  return (
    <View>
      <DashboardHero
        pct={stats.pct}
        collected={stats.collected}
        total={stats.collected + stats.missing}
      />

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
        <StatCard size="md" label="Me faltan" value={String(stats.missing)} sub="unicas" />
        <StatCard size="md" label="Repes" value={String(stats.duplicates)} sub="extras" />
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
        <StatCard label="Completos" value={String(stats.teamsComplete)} sub="/ 48" />
        <StatCard label="A 1 cromo" value={String(stats.teamsOneAway)} />
        <StatCard label="Sin empezar" value={String(stats.teamsZero)} sub="/ 48" />
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
        <StatCard label="Escudos" value={String(stats.badgesCollected)} sub={`/ ${stats.badgesTotal}`} />
        <StatCard label="Leyendas" value={String(stats.legendsCollected)} sub={`/ ${stats.legendsTotal}`} />
        <StatCard label="Estrellas" value={String(stats.starsCollected)} sub={`/ ${stats.starsTotal}`} />
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
        <StatCard
          label="Amigos"
          value={String(stats.friendsCount)}
          onPress={() => router.push("/(tabs)/friends" as never)}
        />
        <StatCard
          label="Matches"
          value={String(stats.matchesCount)}
          onPress={() => router.push("/(tabs)/friends" as never)}
        />
        <StatCard label="Ultima" value={lastAddedValue} sub={lastAddedSub} />
      </View>
    </View>
  );
}
