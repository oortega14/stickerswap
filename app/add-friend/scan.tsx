import { useState, useEffect } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { haptics } from "@/lib/haptics";
import { useAddFriend } from "@/hooks/useAddFriend";
import { isValidInviteCode, normalizeInviteCode } from "@/domain/inviteCode";

export default function ScanFriend() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const addFriend = useAddFriend();

  useEffect(() => {
    if (!permission) requestPermission();
  }, [permission, requestPermission]);

  const onBarcode = async (data: string) => {
    if (scanned) return;
    setScanned(true);
    const code = normalizeInviteCode(data);
    if (!isValidInviteCode(code)) {
      Alert.alert("Código inválido", "El QR no parece un código válido.", [
        { text: "OK", onPress: () => setScanned(false) }
      ]);
      return;
    }
    try {
      await addFriend.mutateAsync(code);
      await haptics.success();
      Alert.alert("¡Amigo agregado!", "Ya pueden ver matches.", [
        { text: "Listo", onPress: () => router.back() }
      ]);
    } catch (e) {
      Alert.alert("Error", String((e as Error).message ?? e), [
        { text: "Reintentar", onPress: () => setScanned(false) }
      ]);
    }
  };

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color="#7c5cff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-black p-6">
        <Text className="text-space-mute text-center mb-4">
          Necesitamos permiso de cámara para escanear códigos.
        </Text>
        <Pressable onPress={requestPermission} className="bg-space-purple px-6 py-3 rounded-xl">
          <Text className="text-white font-semibold">Conceder permiso</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView
        style={{ flex: 1 }}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => onBarcode(data)}
      />
      <View className="absolute inset-0 items-center justify-center pointer-events-none">
        <View
          style={{
            width: 220,
            height: 220,
            borderColor: "#7c5cff",
            borderWidth: 2,
            borderRadius: 24
          }}
        />
        <Text className="text-white mt-4 text-center px-6">
          Apuntá al QR del código de tu amigo.
        </Text>
      </View>
      <Pressable
        onPress={() => router.back()}
        className="absolute top-12 right-4 bg-black/60 rounded-full px-4 py-2"
      >
        <Text className="text-white">Cerrar</Text>
      </Pressable>
    </View>
  );
}
