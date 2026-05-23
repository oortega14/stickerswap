import * as SecureStore from "expo-secure-store";
import { getDb } from "./db";

const ONBOARDING_KEY = "stickerswap_onboarded_v1";

const USER_TABLES = [
  "sticker_status",
  "sync_queue",
  "friends_cache",
  "friend_matches_cache",
  "friend_matches_bidi_cache",
  "trades_cache",
] as const;

export async function clearUserLocalData(): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    for (const table of USER_TABLES) {
      await db.execAsync(`DELETE FROM ${table};`);
    }
  });

  try {
    await SecureStore.deleteItemAsync(ONBOARDING_KEY);
  } catch {
  }
}
