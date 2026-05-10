import { useState } from "react";
import { ScrollView, View, Text, RefreshControl } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { haptics } from "@/lib/haptics";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { useTheme } from "@/theme/ThemeProvider";

type Subtab = "amigos" | "trueques" | "cerca";

export default function Friends() {
  const [tab, setTab] = useState<Subtab>("amigos");
  const { theme } = useTheme();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await haptics.light();
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["friends"] }),
      qc.invalidateQueries({ queryKey: ["matches"] }),
      qc.invalidateQueries({ queryKey: ["pendingRequests"] }),
      qc.invalidateQueries({ queryKey: ["outgoingRequests"] }),
      qc.invalidateQueries({ queryKey: ["nearbyMatches"] }),
      qc.invalidateQueries({ queryKey: ["trades"] })
    ]);
    setRefreshing(false);
  };

  return (
    <ThemedBackground>
      <ScrollView
        className="flex-1 px-4 pt-14"
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
        }
      >
        <Text className="text-space-violet font-bold tracking-widest text-sm mb-4">AMIGOS</Text>

        <View className="mb-4">
          <SegmentedControl<Subtab>
            options={[
              { value: "amigos", label: "Amigos" },
              { value: "trueques", label: "Trueques" },
              { value: "cerca", label: "Cerca" }
            ]}
            value={tab}
            onChange={setTab}
          />
        </View>

        {tab === "amigos" ? (
          <AmigosView />
        ) : tab === "trueques" ? (
          <TruequesView />
        ) : (
          <CercaView />
        )}
      </ScrollView>
    </ThemedBackground>
  );
}

function AmigosView() {
  return null;
}

function TruequesView() {
  return null;
}

function CercaView() {
  return null;
}
