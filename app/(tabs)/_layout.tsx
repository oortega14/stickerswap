import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "@/theme/colors";

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 22, color: focused ? colors.violet : colors.dim }}>{icon}</Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: "shift",
        tabBarStyle: {
          backgroundColor: colors.dark,
          borderTopColor: "rgba(124,92,255,0.2)",
          borderTopWidth: 1
        },
        tabBarActiveTintColor: colors.violet,
        tabBarInactiveTintColor: colors.dim
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: ({ focused }) => <TabIcon icon="⌂" focused={focused} /> }}
      />
      <Tabs.Screen
        name="album"
        options={{ title: "Álbum", tabBarIcon: ({ focused }) => <TabIcon icon="▦" focused={focused} /> }}
      />
      <Tabs.Screen
        name="trades"
        options={{ title: "Cambios", tabBarIcon: ({ focused }) => <TabIcon icon="↔" focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Perfil", tabBarIcon: ({ focused }) => <TabIcon icon="◔" focused={focused} /> }}
      />
    </Tabs>
  );
}
