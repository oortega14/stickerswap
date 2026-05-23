/**
 * @jest-environment node
 */
jest.mock("expo-sqlite", () => require("../setup-sqlite-mock").createSqliteMock());

import { incrementStatus, decrementStatus, getStatus, listStatuses } from "@/data/stickerStatus";
import { initSchema } from "@/data/schema";
import { getDb, _resetDb } from "@/data/db";
import "../setup-sqlite-mock";

beforeEach(async () => {
  _resetDb();
  await initSchema();
  // sembrar 1 sticker para satisfacer FK
  const db = getDb();
  await db.runAsync(
    `INSERT INTO stickers (code, number, team, section, type) VALUES (?, ?, ?, ?, ?)`,
    ["X1", 1, null, "S", "player"]
  );
});

describe("stickerStatus", () => {
  it("getStatus returns 0 when no row exists", async () => {
    expect((await getStatus("X1"))?.count ?? 0).toBe(0);
  });

  it("incrementStatus creates row with count=1, then increments", async () => {
    await incrementStatus("X1");
    expect((await getStatus("X1"))?.count).toBe(1);
    await incrementStatus("X1");
    await incrementStatus("X1");
    expect((await getStatus("X1"))?.count).toBe(3);
  });

  it("decrementStatus respects min 0", async () => {
    await decrementStatus("X1");
    expect((await getStatus("X1"))?.count).toBe(0);
    await incrementStatus("X1");
    await incrementStatus("X1");
    await decrementStatus("X1");
    expect((await getStatus("X1"))?.count).toBe(1);
  });

  it("listStatuses returns all rows", async () => {
    await incrementStatus("X1");
    const all = await listStatuses();
    expect(all).toHaveLength(1);
    expect(all[0].stickerCode).toBe("X1");
  });
});
