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

function decodeJwtPayload(token: string): { nonce?: string } {
  const [, payload] = token.split(".");
  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "==".substring(0, (4 - (base64.length % 4)) % 4);
  try {
    return JSON.parse(atob(padded));
  } catch {
    return {};
  }
}

export async function signInWithGoogle(): Promise<void> {
  configureOnce();
  await GoogleSignin.hasPlayServices();
  const result = await GoogleSignin.signIn();
  const idToken = result.data?.idToken;
  if (!idToken) {
    throw new Error("No idToken from Google");
  }

  // Google's mobile SDK v16+ auto-generates a nonce and embeds it in the id_token.
  // Supabase requires the same nonce string to be passed back so it can verify
  // the token. We extract it from the JWT payload and forward it.
  const { nonce } = decodeJwtPayload(idToken);

  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
    ...(nonce ? { nonce } : {})
  });
  if (error) throw error;
}

export function isCancelError(e: unknown): boolean {
  return (e as { code?: string })?.code === statusCodes.SIGN_IN_CANCELLED;
}
