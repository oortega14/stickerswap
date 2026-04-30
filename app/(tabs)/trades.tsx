import { useState } from "react";
import { ScrollView, View, Text, Pressable, Switch, Share } from "react-native";
import * as Haptics from "expo-haptics";
import { StarryBackground } from "@/ui/StarryBackground";
import { GlowCard } from "@/ui/GlowCard";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { useMyList } from "@/hooks/useMyList";
import { useTradePrefs } from "@/store/tradePreferences";

type Tab = "matches" | "mine";

export default function Trades() {
  const [tab, setTab] = useState<Tab>("mine");
  const { data, text, isLoading } = useMyList();
  const { groupBySection, setGroupBySection } = useTradePrefs();

  const onShare = async () => {
    if (!text) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await Share.share({ message: text, title: "Mi lista de cambios" });
  };

  return (
    <StarryBackground>
      <ScrollView className="flex-1 px-4 pt-14" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-space-violet font-bold tracking-widest text-sm mb-4">CAMBIOS</Text>

        <View className="mb-4">
          <SegmentedControl<Tab>
            options={[
              { value: "matches", label: "Matches" },
              { value: "mine", label: "Mi lista" }
            ]}
            value={tab}
            onChange={setTab}
          />
        </View>

        {tab === "matches" ? (
          <GlowCard>
            <Text className="text-space-ink text-center text-base mb-2">🛸</Text>
            <Text className="text-space-mute text-center">
              Los matches con amigos llegan en la próxima versión.
            </Text>
          </GlowCard>
        ) : isLoading || !data ? (
          <Text className="text-space-mute text-center mt-4">Cargando…</Text>
        ) : (
          <>
            <View className="flex-row gap-3 mb-3">
              <GlowCard className="flex-1">
                <Text className="text-space-mute text-xs">NECESITO</Text>
                <Text className="text-space-ink text-2xl font-bold">{data.needed.length}</Text>
              </GlowCard>
              <GlowCard className="flex-1">
                <Text className="text-space-mute text-xs">REPETIDAS</Text>
                <Text className="text-space-ink text-2xl font-bold">{data.duplicates.length}</Text>
              </GlowCard>
            </View>

            <GlowCard className="mb-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-space-ink text-sm">Agrupar por sección</Text>
                <Switch
                  value={groupBySection}
                  onValueChange={setGroupBySection}
                  trackColor={{ false: "#1c1648", true: "#7c5cff" }}
                />
              </View>
            </GlowCard>

            <GlowCard className="mb-4">
              <Text className="text-space-mute text-xs mb-2 tracking-widest">VISTA PREVIA</Text>
              <Text className="text-space-ink text-xs" style={{ fontFamily: "Courier" }}>
                {text || "Sin contenido para compartir aún."}
              </Text>
            </GlowCard>

            <Pressable
              onPress={onShare}
              disabled={!text}
              className={`rounded-xl py-4 items-center ${text ? "bg-space-purple" : "bg-space-mid"}`}
            >
              <Text className="text-white font-semibold">Compartir mi lista</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </StarryBackground>
  );
}
