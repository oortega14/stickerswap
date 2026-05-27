import "../global.css";
import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, AppState } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import NetInfo from "@react-native-community/netinfo";
import { initSchema } from "@/data/schema";
import { seedStickers, type StickerDataset } from "@/data/seed";
import { ThemeProvider, useTheme } from "@/theme/ThemeProvider";
import { I18nProvider } from "@/i18n/I18nProvider";
import { SessionProvider, useSession } from "@/auth/useSession";
import { drainQueue, pullRemoteStatus } from "@/sync/worker";
import { fetchActiveTrades } from "@/social/trades";
import { subscribeToFriendUpdates, unsubscribe } from "@/social/realtime";
import { justScanned } from "@/social/recentScans";
import { supabase } from "@/auth/supabaseClient";
import { Snackbar, showSnackbar } from "@/ui/Snackbar";
import { useHydrateOnboarding, useOnboardingSeen } from "@/lib/onboarding";
import datasetJson from "../assets/stickers.json";

const dataset = datasetJson as StickerDataset;
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5_000, retry: false, refetchOnWindowFocus: false }
  }
});

function ThemedLoader() {
  const { theme } = useTheme();
  return <ActivityIndicator color={theme.accent} />;
}

function ThemedStack() {
  const { theme } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.bg },
        animation: "slide_from_right"
      }}
    >
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="sticker/[code]" options={{ presentation: "modal", animation: "fade_from_bottom" }} />
      <Stack.Screen name="team/[code]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="section/[name]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="profile/edit" options={{ presentation: "modal", animation: "fade_from_bottom" }} />
      <Stack.Screen name="about" options={{ presentation: "modal", animation: "fade_from_bottom" }} />
      <Stack.Screen name="trades/propose/[username]" options={{ presentation: "modal", animation: "fade_from_bottom" }} />
    </Stack>
  );
}

function ThemedStatusBar() {
  const { mode } = useTheme();
  return <StatusBar style={mode === "dark" ? "light" : "dark"} />;
}

function SyncEngine() {
  const { user } = useSession();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const tick = async () => {
      if (cancelled) return;
      try {
        await drainQueue(user.id);
      } catch (e) {
        console.warn("drain error", e);
      }
    };

    (async () => {
      // Drain primero: si el usuario venía de modo invitado, esta cola tiene
      // su progreso local que debe subir antes de cualquier pull que pudiera
      // sobreescribirlo con data más vieja del servidor.
      await tick();
      try {
        await pullRemoteStatus(user.id);
      } catch (e) {
        console.warn("pull error", e);
      }
      try {
        await fetchActiveTrades();
      } catch (e) {
        console.warn("trades pull error", e);
      }
      timer = setInterval(tick, 30_000);
    })();

    const appSub = AppState.addEventListener("change", (s) => {
      if (s === "active") tick();
    });
    const netSub = NetInfo.addEventListener((s) => {
      if (s.isConnected) tick();
    });

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      appSub.remove();
      netSub();
    };
  }, [user]);

  return null;
}

function FriendUpdatesBridge() {
  const { user } = useSession();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;
    const channel = subscribeToFriendUpdates({
      onStickerStatusChange: () => {
        qc.invalidateQueries({ queryKey: ["matches"] });
        qc.invalidateQueries({ queryKey: ["stickers"] });
      },
      onFriendshipChange: (payload) => {
        qc.invalidateQueries({ queryKey: ["pendingRequests"] });
        qc.invalidateQueries({ queryKey: ["outgoingRequests"] });
        qc.invalidateQueries({ queryKey: ["friends"] });
        announceFriendshipChange(payload, user.id);
      },
      onTradeChange: (payload) => {
        qc.invalidateQueries({ queryKey: ["trades"] });
        const newStatus = payload?.new?.status as string | undefined;
        const oldStatus = payload?.old?.status as string | undefined;
        if (newStatus && newStatus !== oldStatus) {
          announceTradeChange(payload, user.id);
        }
        if (newStatus === "completed" && oldStatus !== "completed") {
          pullRemoteStatus(user.id)
            .then(() => {
              qc.invalidateQueries({ queryKey: ["stickers"] });
              qc.invalidateQueries({ queryKey: ["matches"] });
              qc.invalidateQueries({ queryKey: ["progress"] });
            })
            .catch((e) => console.warn("pullRemoteStatus on trade completion failed", e));
        }
      }
    });
    return () => unsubscribe(channel);
  }, [user, qc]);

  return null;
}

async function announceFriendshipChange(payload: any, meId: string) {
  if (payload?.eventType !== "INSERT") return;
  const row = payload.new;
  if (
    row?.friend_id !== meId ||
    row?.source !== "qr_code" ||
    row?.status !== "accepted"
  ) {
    return;
  }
  const scannerId = row.user_id as string;
  if (justScanned(scannerId)) return; // es el echo de mi propio scan

  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", scannerId)
    .maybeSingle();
  const username = (data as { username?: string } | null)?.username;
  if (username) {
    showSnackbar(`@${username} escaneó tu QR · ya son amigos`);
  }
}

function announceTradeChange(payload: any, meId: string) {
  const newStatus = payload?.new?.status as string | undefined;
  const oldStatus = payload?.old?.status as string | undefined;
  const proposerId = payload?.new?.proposer_id as string | undefined;
  const recipientId = payload?.new?.recipient_id as string | undefined;
  const otherIsProposer = proposerId !== meId;

  let msg: string | null = null;
  if (oldStatus === "pending" && newStatus === "accepted") {
    msg = otherIsProposer ? "Aceptaste un cambio" : "Tu propuesta fue aceptada";
  } else if (oldStatus === "pending" && newStatus === "declined") {
    msg = otherIsProposer ? "Rechazaste un cambio" : "Tu propuesta fue rechazada";
  } else if (newStatus === "completed") {
    msg = "Cambio completado ✓";
  } else if (
    oldStatus === "accepted" &&
    newStatus === "accepted" &&
    payload?.new?.proposer_confirmed_at !== payload?.old?.proposer_confirmed_at &&
    proposerId !== meId
  ) {
    msg = "Tu contraparte marcó como hecho — confirma";
  } else if (
    oldStatus === "accepted" &&
    newStatus === "accepted" &&
    payload?.new?.recipient_confirmed_at !== payload?.old?.recipient_confirmed_at &&
    recipientId !== meId
  ) {
    msg = "Tu contraparte marcó como hecho — confirma";
  }
  if (msg) showSnackbar(msg);
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, user, isLoading } = useSession();
  const onboardedIntro = useOnboardingSeen();
  const router = useRouter();
  const segments = useSegments() as string[];

  useEffect(() => {
    if (isLoading || onboardedIntro === null) return;

    const inAuth = segments[0] === "(auth)";
    const inOnboardingIntro = segments[0] === "onboarding";

    if (!onboardedIntro) {
      if (!inOnboardingIntro) router.replace("/onboarding/1" as never);
      return;
    }

    if (!session) {
      if (!inAuth) router.replace("/(auth)/sign-in" as never);
      return;
    }

    if (!user) return;

    if (!user.onboarding_completed) {
      const path = segments.join("/");
      if (path !== "(auth)/onboarding" && path !== "(auth)/location") {
        router.replace("/(auth)/onboarding" as never);
      }
      return;
    }

    if (inAuth || inOnboardingIntro) {
      router.replace("/(tabs)" as never);
    }
  }, [isLoading, session, user, segments, router, onboardedIntro]);

  return <>{children}</>;
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useHydrateOnboarding();

  useEffect(() => {
    (async () => {
      try {
        await initSchema();
        await seedStickers(dataset);
        setReady(true);
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <I18nProvider>
        {error ? (
          <View className="flex-1 items-center justify-center bg-space-deep p-6">
            <Text className="text-red-300 text-center">Error: {error}</Text>
          </View>
        ) : !ready ? (
          <View className="flex-1 items-center justify-center bg-space-deep">
            <ThemedLoader />
          </View>
        ) : (
          <QueryClientProvider client={queryClient}>
            <SessionProvider />
            <SyncEngine />
            <FriendUpdatesBridge />
            <ThemedStatusBar />
            <AuthGate>
              <ThemedStack />
            </AuthGate>
            <Snackbar />
          </QueryClientProvider>
        )}
        </I18nProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
