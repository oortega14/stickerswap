/**
 * @jest-environment node
 */
jest.mock("expo-sqlite", () => require("../setup-sqlite-mock").createSqliteMock());

import { enqueue, peekBatch, removeIds, bumpAttempts, countPending, countStuck } from "@/data/syncQueue";
import { initSchema } from "@/data/schema";
import { _resetDb, getDb } from "@/data/db";
import "../setup-sqlite-mock";

beforeEach(async () => {
  _resetDb();
  await initSchema();
  const db = getDb();
  await db.runAsync(
    `INSERT INTO stickers (code, number, name, team, section, type) VALUES ('X', 1, 'foo', null, 'S', 'player')`
  );
});

describe("syncQueue", () => {
  it("enqueue and count pending", async () => {
    await enqueue("X", 1);
    await enqueue("X", 2);
    expect(await countPending()).toBe(2);
  });

  it("peekBatch returns earliest first, capped at limit", async () => {
    await enqueue("X", 1);
    await enqueue("X", 2);
    await enqueue("X", 3);
    const batch = await peekBatch(2);
    expect(batch).toHaveLength(2);
    expect(batch[0].count).toBe(1);
  });

  it("removeIds drops only the rows passed", async () => {
    await enqueue("X", 1);
    await enqueue("X", 2);
    const batch = await peekBatch(10);
    await removeIds([batch[0].id]);
    expect(await countPending()).toBe(1);
  });

  it("bumpAttempts increments attempts", async () => {
    await enqueue("X", 1);
    const [row] = await peekBatch(1);
    await bumpAttempts([row.id]);
    const [updated] = await peekBatch(1);
    expect(updated.attempts).toBe(1);
  });

  it("countStuck only counts attempts >= 10", async () => {
    await enqueue("X", 1);
    expect(await countStuck()).toBe(0);
    const [row] = await peekBatch(1);
    for (let i = 0; i < 10; i++) await bumpAttempts([row.id]);
    expect(await countStuck()).toBe(1);
  });
});
