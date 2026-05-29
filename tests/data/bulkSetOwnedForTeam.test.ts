/**
 * @jest-environment node
 */
jest.mock("expo-sqlite", () => require("../setup-sqlite-mock").createSqliteMock());

import { bulkSetOwnedForTeam, incrementStatus, getStatus } from "@/data/stickerStatus";
import { peekBatch } from "@/data/syncQueue";
import { initSchema } from "@/data/schema";
import { getDb, _resetDb } from "@/data/db";
import "../setup-sqlite-mock";

beforeEach(async () => {
  _resetDb();
  await initSchema();
  const db = getDb();
  // 3 stickers del team ARG, 1 de URU, 1 sin team (Intro)
  await db.runAsync(
    `INSERT INTO stickers (code, number, team, section, type) VALUES
     (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)`,
    [
      "ARG-1", 1, "ARG", "Argentina", "player",
      "ARG-2", 2, "ARG", "Argentina", "player",
      "ARG-3", 3, "ARG", "Argentina", "player",
      "URU-1", 1, "URU", "Uruguay", "player",
      "INT-1", 1, null, "Intro", "logo"
    ]
  );
});

describe("bulkSetOwnedForTeam", () => {
  it("sets count=1 for all team stickers when all start at 0", async () => {
    const affected = await bulkSetOwnedForTeam("ARG");
    expect(affected).toBe(3);
    expect((await getStatus("ARG-1"))?.count).toBe(1);
    expect((await getStatus("ARG-2"))?.count).toBe(1);
    expect((await getStatus("ARG-3"))?.count).toBe(1);
  });

  it("preserves count when sticker already has count >= 1 (duplicates intact)", async () => {
    await incrementStatus("ARG-1"); // count = 1
    await incrementStatus("ARG-1"); // count = 2 (duplicate)
    const affected = await bulkSetOwnedForTeam("ARG");
    expect(affected).toBe(2); // ARG-2, ARG-3 affected; ARG-1 preserved
    expect((await getStatus("ARG-1"))?.count).toBe(2);
    expect((await getStatus("ARG-2"))?.count).toBe(1);
    expect((await getStatus("ARG-3"))?.count).toBe(1);
  });

  it("does not affect stickers from other teams", async () => {
    await bulkSetOwnedForTeam("ARG");
    expect((await getStatus("URU-1"))?.count ?? 0).toBe(0);
    expect((await getStatus("INT-1"))?.count ?? 0).toBe(0);
  });

  it("returns 0 when all team stickers already have count >= 1", async () => {
    await incrementStatus("ARG-1");
    await incrementStatus("ARG-2");
    await incrementStatus("ARG-3");
    const affected = await bulkSetOwnedForTeam("ARG");
    expect(affected).toBe(0);
  });

  it("enqueues affected stickers to sync_queue with count=1", async () => {
    await bulkSetOwnedForTeam("ARG");
    const queue = await peekBatch(100);
    expect(queue).toHaveLength(3);
    expect(queue.map((q) => q.stickerCode).sort()).toEqual(["ARG-1", "ARG-2", "ARG-3"]);
    queue.forEach((q) => expect(q.count).toBe(1));
  });

  it("does not enqueue stickers that were already owned", async () => {
    await incrementStatus("ARG-1"); // 1 queue entry from increment
    await bulkSetOwnedForTeam("ARG"); // affects ARG-2, ARG-3 only → 2 more queue entries
    const queue = await peekBatch(100);
    expect(queue).toHaveLength(3);
  });

  it("returns 0 for unknown team code", async () => {
    const affected = await bulkSetOwnedForTeam("XYZ");
    expect(affected).toBe(0);
  });
});
