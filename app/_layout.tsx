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
import { ThemeProvider } from "@/theme/ThemeProvider";
import { SessionProvider, useSession } from "@/auth/useSession";
import { drainQueue, pullRemoteStatus } from "@/sync/worker";
import { subscribeToFriendUpdates, unsubscribe } from "@/social/realtime";
import { useHydrateOnboarding, useOnboardingSeen } from "@/lib/onboarding";
import datasetJson from "../assets/stickers.json";

const dataset = datasetJson as StickerDataset;
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5_000, retry: false, refetchOnWindowFocus: false }
  }
});

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
      try {
        await pullRemoteStatus(user.id);
      } catch (e) {
        console.warn("pull error", e);
      }
      await tick();
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
    const channel = subscribeToFriendUpdates(() => {
      qc.invalidateQueries({ queryKey: ["matches"] });
    });
    return () => unsubscribe(channel);
  }, [user, qc]);

  return null;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, user, isLoading } = useSession();
  const onboardedIntro = useOnboardingSeen();
  const router = useRouter();
  const segments = useSegments() as string[];

  useEffect(() => {
    console.log("[AuthGate]", {
      isLoading,
      onboardedIntro,
      hasSession: !!session,
      hasUser: !!user,
      username: user?.username,
      segments
    });
    if (isLoading || onboardedIntro === null) {
      console.log("[AuthGate] waiting (isLoading or onboardedIntro=null)");
      return;
    }
    const inAuth = segments[0] === "(auth)";
    const inOnboardingIntro = segments[0] === "onboarding";

    if (!onboardedIntro) {
      if (!inOnboardingIntro) {
        console.log("[AuthGate] → /onboarding/1");
        router.replace("/onboarding/1" as never);
      }
      return;
    }

    if (!session) {
      if (!inAuth) {
        console.log("[AuthGate] no session → /(auth)/sign-in");
        router.replace("/(auth)/sign-in" as never);
      } else {
        console.log("[AuthGate] no session, already in auth");
      }
      return;
    }

    if (!user) {
      console.log("[AuthGate] session ok, waiting for profile");
      return;
    }

    if (!user.onboarding_completed) {
      if (segments.join("/") !== "(auth)/onboarding") {
        console.log("[AuthGate] onboarding pending → /(auth)/onboarding");
        router.replace("/(auth)/onboarding" as never);
      }
      return;
    }

    if (inAuth || inOnboardingIntro) {
      console.log("[AuthGate] real username → /(tabs)");
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

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-space-deep p-6">
        <Text className="text-red-300 text-center">Error: {error}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-space-deep">
        <ActivityIndicator color="#7c5cff" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider />
        <SyncEngine />
        <FriendUpdatesBridge />
        <StatusBar style="dark" />
        <AuthGate>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#000" },
              animation: "slide_from_right"
            }}
          >
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="sticker/[code]" options={{ presentation: "modal", animation: "fade_from_bottom" }} />
            <Stack.Screen name="team/[code]" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="profile/edit" options={{ presentation: "modal", animation: "fade_from_bottom" }} />
            <Stack.Screen name="about" options={{ presentation: "modal", animation: "fade_from_bottom" }} />
          </Stack>
        </AuthGate>
      </QueryClientProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
