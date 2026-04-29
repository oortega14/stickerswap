import { View, Text } from "react-native";
import { StarryBackground } from "@/ui/StarryBackground";

export default function TradesPlaceholder() {
  return (
    <StarryBackground>
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-space-mute text-center text-base">
          Cambios — disponible en la próxima versión.
        </Text>
      </View>
    </StarryBackground>
  );
}
