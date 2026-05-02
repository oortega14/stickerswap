import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import { supabase } from "./supabaseClient";

WebBrowser.maybeCompleteAuthSession();

async function createSessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);
  const access_token = params.access_token;
  const refresh_token = params.refresh_token;
  if (!access_token || !refresh_token) {
    throw new Error("Faltan tokens en el callback de OAuth");
  }
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
}

export async function signInWithGoogle(): Promise<void> {
  const redirectTo = Linking.createURL("/");
  console.log("=== GOOGLE OAUTH DEBUG ===");
  console.log("redirectTo:", redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true
    }
  });
  if (error) throw error;
  if (!data?.url) throw new Error("No OAuth URL returned by Supabase");
  console.log("supabase OAuth URL:", data.url);

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  console.log("WebBrowser result:", result);

  if (result.type === "success") {
    await createSessionFromUrl(result.url);
    return;
  }
  if (result.type === "cancel" || result.type === "dismiss") {
    throw Object.assign(new Error("Sign-in cancelled"), { code: "CANCELLED" });
  }
  throw new Error("OAuth flow falló");
}

export function isCancelError(e: unknown): boolean {
  return (e as { code?: string })?.code === "CANCELLED";
}
