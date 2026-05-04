import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { usePendingRequestsCount } from "@/hooks/usePendingRequests";

function TabIcon({ icon, focused, active, inactive }: { icon: string; focused: boolean; active: string; inactive: string }) {
  return (
    <Text style={{ fontSize: 22, color: focused ? active : inactive }}>{icon}</Text>
  );
}

export default function TabsLayout() {
  const { theme } = useTheme();
  const pendingCount = usePendingRequestsCount();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: "shift",
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
          borderTopWidth: 1
        },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMute
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: ({ focused }) => <TabIcon icon="⌂" focused={focused} active={theme.accent} inactive={theme.textMute} /> }}
      />
      <Tabs.Screen
        name="album"
        options={{ title: "Álbum", tabBarIcon: ({ focused }) => <TabIcon icon="▦" focused={focused} active={theme.accent} inactive={theme.textMute} /> }}
      />
      <Tabs.Screen
        name="trades"
        options={{
          title: "Cambios",
          tabBarIcon: ({ focused }) => <TabIcon icon="↔" focused={focused} active={theme.accent} inactive={theme.textMute} />,
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Perfil", tabBarIcon: ({ focused }) => <TabIcon icon="◔" focused={focused} active={theme.accent} inactive={theme.textMute} /> }}
      />
    </Tabs>
  );
}
