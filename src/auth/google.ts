import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { supabase } from "./supabaseClient";

let configured = false;

function configureOnce() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID!
  });
  configured = true;
}

export async function signInWithGoogle(): Promise<void> {
  configureOnce();
  await GoogleSignin.hasPlayServices();
  const result = await GoogleSignin.signIn();
  const idToken = result.data?.idToken;
  if (!idToken) {
    throw new Error("No idToken from Google");
  }
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken
  });
  if (error) throw error;
}

export function isCancelError(e: unknown): boolean {
  return (e as { code?: string })?.code === statusCodes.SIGN_IN_CANCELLED;
}
