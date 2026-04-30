import { supabase } from "@/auth/supabaseClient";
import { applyRemoteStatus, getStatus } from "@/data/stickerStatus";
import { peekBatch, removeIds, bumpAttempts } from "@/data/syncQueue";
import { resolveConflict } from "./conflict";

let drainInFlight = false;

interface RemoteRow {
  sticker_code: string;
  count: number;
  updated_at: string;
}

export async function pullRemoteStatus(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("sticker_status")
    .select("sticker_code, count, updated_at")
    .eq("user_id", userId);
  if (error) throw error;

  let applied = 0;
  for (const row of (data ?? []) as RemoteRow[]) {
    const remoteTs = Date.parse(row.updated_at);
    const local = await getStatus(row.sticker_code);
    const winner = resolveConflict(
      local ? { count: local.count, updatedAt: local.updatedAt } : null,
      { count: row.count, updatedAt: remoteTs }
    );
    if (winner && (!local || winner.updatedAt > local.updatedAt)) {
      await applyRemoteStatus(row.sticker_code, winner.count, winner.updatedAt);
      applied += 1;
    }
  }
  return applied;
}

export async function drainQueue(userId: string, batchSize = 50): Promise<{
  pushed: number;
  failed: number;
}> {
  if (drainInFlight) return { pushed: 0, failed: 0 };
  drainInFlight = true;

  let pushed = 0;
  let failed = 0;
  try {
    const batch = await peekBatch(batchSize);
    if (batch.length === 0) return { pushed: 0, failed: 0 };

    // Compactar a la última intención por sticker_code (último count gana)
    const latest = new Map<string, typeof batch[number]>();
    for (const row of batch) latest.set(row.stickerCode, row);

    const payload = Array.from(latest.values()).map((r) => ({
      user_id: userId,
      sticker_code: r.stickerCode,
      count: r.count,
      updated_at: new Date(r.ts).toISOString()
    }));

    const { error } = await supabase
      .from("sticker_status")
      .upsert(payload, { onConflict: "user_id,sticker_code" });

    if (error) {
      await bumpAttempts(batch.map((r) => r.id));
      failed = batch.length;
    } else {
      await removeIds(batch.map((r) => r.id));
      pushed = batch.length;
    }
  } finally {
    drainInFlight = false;
  }
  return { pushed, failed };
}
