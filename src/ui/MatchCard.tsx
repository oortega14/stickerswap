import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import { GlowCard } from "@/ui/GlowCard";
import { StickerMiniThumb } from "@/ui/StickerMiniThumb";
import { ActiveTradeBanner } from "@/ui/ActiveTradeBanner";
import { useTradeForFriend } from "@/hooks/useTradeForFriend";
import type { FriendMatchSummary } from "@/domain/types";

interface Props {
  summary: FriendMatchSummary;
}

const MAX_THUMBS = 4;

export function MatchCard({ summary }: Props) {
  const { theme } = useTheme();
  const router = useRouter();
  const trade = useTradeForFriend(summary.friendId);

  const youNeedSample = summary.theyHaveYouNeed.slice(0, MAX_THUMBS);
  const youNeedExtra = Math.max(0, summary.theyHaveYouNeed.length - MAX_THUMBS);
  const youGiveSample = summary.youHaveTheyNeed.slice(0, MAX_THUMBS);
  const youGiveExtra = Math.max(0, summary.youHaveTheyNeed.length - MAX_THUMBS);

  const goToFriend = () => router.push(`/friends/${summary.username}` as never);
  const goToPropose = () => router.push(`/trades/propose/${summary.username}` as never);

  return (
    <Pressable onPress={goToFriend} accessibilityRole="button" accessibilityLabel={`Abrir @${summary.username}`}>
      <GlowCard className="mb-3">
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: "700" }}>
          @{summary.username}
        </Text>

        {trade ? (
          <View style={{ marginTop: 10 }}>
            <ActiveTradeBanner trade={trade} />
          </View>
        ) : null}

        <View style={{ flexDirection: "row", marginTop: 10, gap: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.textMute, fontSize: 11, fontWeight: "700", marginBottom: 6 }}>
              QUERÉS · {summary.theyHaveYouNeed.length}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {youNeedSample.map((code) => (
                <StickerMiniThumb key={`need-${code}`} code={code} />
              ))}
              {youNeedExtra > 0 && (
                <View
                  style={{
                    width: 32,
                    height: 40,
                    borderRadius: 4,
                    backgroundColor: theme.card,
                    borderWidth: 1,
                    borderColor: theme.border,
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Text style={{ color: theme.textMute, fontSize: 11, fontWeight: "700" }}>
                    +{youNeedExtra}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.textMute, fontSize: 11, fontWeight: "700", marginBottom: 6 }}>
              LE DAS · {summary.youHaveTheyNeed.length}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {youGiveSample.map((code) => (
                <StickerMiniThumb key={`give-${code}`} code={code} />
              ))}
              {youGiveExtra > 0 && (
                <View
                  style={{
                    width: 32,
                    height: 40,
                    borderRadius: 4,
                    backgroundColor: theme.card,
                    borderWidth: 1,
                    borderColor: theme.border,
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Text style={{ color: theme.textMute, fontSize: 11, fontWeight: "700" }}>
                    +{youGiveExtra}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {!trade && summary.theyHaveYouNeed.length > 0 && summary.youHaveTheyNeed.length > 0 && (
          <Pressable
            onPress={goToPropose}
            accessibilityRole="button"
            accessibilityLabel={`Proponer cambio a ${summary.username}`}
            style={{
              marginTop: 12,
              paddingVertical: 10,
              borderRadius: 8,
              backgroundColor: theme.accent,
              alignItems: "center"
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Proponer cambio  ›</Text>
          </Pressable>
        )}
      </GlowCard>
    </Pressable>
  );
}
