import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { supabase } from "./supabaseClient";

export async function isAppleAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  return AppleAuthentication.isAvailableAsync();
}

export async function signInWithApple(): Promise<void> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL
    ]
  });
  if (!credential.identityToken) {
    throw new Error("No identity token from Apple");
  }
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken
  });
  if (error) throw error;
}

export function isAppleCancelError(e: unknown): boolean {
  // expo-apple-authentication tira un Error con code "ERR_REQUEST_CANCELED"
  // cuando el usuario cierra el sheet sin completar.
  return (e as { code?: string })?.code === "ERR_REQUEST_CANCELED";
}
