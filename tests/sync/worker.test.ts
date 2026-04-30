/**
 * @jest-environment node
 */
jest.mock("expo-sqlite", () => require("../setup-sqlite-mock").createSqliteMock());

import { drainQueue } from "@/sync/worker";
import { initSchema } from "@/data/schema";
import { _resetDb, getDb } from "@/data/db";
import { incrementStatus } from "@/data/stickerStatus";
import { countPending } from "@/data/syncQueue";
import "../setup-sqlite-mock";

const mockUpsert = jest.fn();
jest.mock("@/auth/supabaseClient", () => ({
  supabase: {
    from: () => ({
      upsert: (...args: unknown[]) => mockUpsert(...args)
    })
  }
}));

beforeEach(async () => {
  _resetDb();
  await initSchema();
  mockUpsert.mockReset();
  const db = getDb();
  await db.runAsync(
    `INSERT INTO stickers (code, number, name, team, section, type) VALUES ('X', 1, 'foo', null, 'S', 'player')`
  );
});

it("drains queue on success", async () => {
  mockUpsert.mockReturnValueOnce({ error: null });
  await incrementStatus("X");
  await incrementStatus("X");
  expect(await countPending()).toBe(2);
  const r = await drainQueue("u1");
  expect(r.pushed).toBe(2);
  expect(await countPending()).toBe(0);
});

it("bumps attempts on failure", async () => {
  mockUpsert.mockReturnValueOnce({ error: { message: "boom" } });
  await incrementStatus("X");
  const r = await drainQueue("u1");
  expect(r.failed).toBe(1);
  expect(await countPending()).toBe(1);
});
