import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import * as Crypto from "expo-crypto";
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

  // Generamos un nonce aleatorio. Le pasamos el SHA-256 a Google (lo embebe
  // en el id_token) y el raw a Supabase. Supabase recompone el hash y verifica
  // que coincida con el del token. Sin esto, Supabase rechaza el token con
  // "passed nonce and nonce in id_token should either both exist or not".
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce
  );

  // El tipo de signIn no expone `nonce` en la versión actual del binding,
  // pero el SDK nativo iOS sí lo acepta. Cast intencional.
  const result = await (GoogleSignin.signIn as (opts: { nonce: string }) => Promise<{
    data?: { idToken: string | null };
  }>)({ nonce: hashedNonce });

  const idToken = result.data?.idToken;
  if (!idToken) {
    throw new Error("No idToken from Google");
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
    nonce: rawNonce
  });
  if (error) throw error;
}

export function isCancelError(e: unknown): boolean {
  return (e as { code?: string })?.code === statusCodes.SIGN_IN_CANCELLED;
}
