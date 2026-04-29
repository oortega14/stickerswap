/**
 * @jest-environment node
 */
jest.mock("expo-sqlite", () => require("../setup-sqlite-mock").createSqliteMock());

import { seedStickers, getInstalledDatasetVersion } from "@/data/seed";
import { initSchema } from "@/data/schema";
import { getDb, _resetDb } from "@/data/db";
import "../setup-sqlite-mock";

const sample = {
  version: 2,
  album: "Test",
  stickers: [
    { code: "X1", number: 1, name: "Foo", team: null, section: "S1", type: "player" as const }
  ]
};

beforeEach(async () => {
  _resetDb();
  await initSchema();
});

describe("seedStickers", () => {
  it("inserts stickers on first run", async () => {
    await seedStickers(sample);
    const db = getDb();
    const rows = await db.getAllAsync<{ code: string }>(`SELECT code FROM stickers`);
    expect(rows.map((r) => r.code)).toEqual(["X1"]);
    expect(await getInstalledDatasetVersion()).toBe(2);
  });

  it("does nothing if installed version >= dataset version", async () => {
    await seedStickers(sample);
    const sample2 = { ...sample, stickers: [{ ...sample.stickers[0], code: "Y2" }] };
    await seedStickers({ ...sample2, version: 2 });
    const db = getDb();
    const rows = await db.getAllAsync<{ code: string }>(`SELECT code FROM stickers`);
    expect(rows.map((r) => r.code)).toEqual(["X1"]);
  });

  it("re-seeds when dataset version is higher", async () => {
    await seedStickers(sample);
    const sample2 = {
      version: 3,
      album: "Test",
      stickers: [
        { code: "X1", number: 1, name: "Foo", team: null, section: "S1", type: "player" as const },
        { code: "X2", number: 2, name: "Bar", team: null, section: "S2", type: "player" as const }
      ]
    };
    await seedStickers(sample2);
    const db = getDb();
    const rows = await db.getAllAsync<{ code: string }>(`SELECT code FROM stickers ORDER BY code`);
    expect(rows.map((r) => r.code)).toEqual(["X1", "X2"]);
    expect(await getInstalledDatasetVersion()).toBe(3);
  });
});
