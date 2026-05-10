import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import { supabase } from "./supabaseClient";

WebBrowser.maybeCompleteAuthSession();

function parseTokensFromUrl(url: string): { access_token?: string; refresh_token?: string; error?: string } {
  // Tokens van en el fragment (#) por OAuth implicit flow.
  // QueryParams a veces no maneja fragmentos consistentemente, así que
  // parseamos manual.
  const out: Record<string, string> = {};
  const hashIdx = url.indexOf("#");
  const queryIdx = url.indexOf("?");
  const sources: string[] = [];
  if (hashIdx >= 0) sources.push(url.slice(hashIdx + 1));
  if (queryIdx >= 0) sources.push(url.slice(queryIdx + 1, hashIdx >= 0 ? hashIdx : undefined));
  for (const src of sources) {
    for (const pair of src.split("&")) {
      const [k, v] = pair.split("=");
      if (k) out[decodeURIComponent(k)] = decodeURIComponent(v ?? "");
    }
  }
  return {
    access_token: out.access_token,
    refresh_token: out.refresh_token,
    error: out.error_description ?? out.error
  };
}

async function createSessionFromUrl(url: string) {
  // Intenta primero con QueryParams (cubre el camino estándar).
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);
  let access_token: string | undefined = params.access_token;
  let refresh_token: string | undefined = params.refresh_token;

  if (!access_token || !refresh_token) {
    // Fallback: parseo manual del fragment.
    const fallback = parseTokensFromUrl(url);
    if (fallback.error) throw new Error(fallback.error);
    access_token = fallback.access_token;
    refresh_token = fallback.refresh_token;
  }

  if (!access_token || !refresh_token) {
    throw new Error("Faltan tokens en el callback de OAuth");
  }
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
}

export async function signInWithGoogle(): Promise<void> {
  const redirectTo = Linking.createURL("/");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true
    }
  });
  if (error) throw error;
  if (!data?.url) throw new Error("No OAuth URL returned by Supabase");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

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
