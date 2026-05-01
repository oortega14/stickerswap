import * as SecureStore from "expo-secure-store";

const KEY = "panini_onboarded_v1";

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(KEY);
    return v === "1";
  } catch {
    return false;
  }
}

export async function markOnboardingSeen(): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, "1");
  } catch {
    // best effort — if Keychain is unavailable, user just sees onboarding again
  }
}
