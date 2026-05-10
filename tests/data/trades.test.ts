/**
 * @jest-environment node
 */
jest.mock("expo-sqlite", () => require("../setup-sqlite-mock").createSqliteMock());

import {
  upsertTrade,
  listActiveTrades,
  getActiveTradeForFriend,
  getTradeById,
  removeTrade
} from "@/data/trades";
import { initSchema } from "@/data/schema";
import { _resetDb } from "@/data/db";
import "../setup-sqlite-mock";
import type { Trade } from "@/domain/types";

const t = (overrides: Partial<Trade>): Trade => ({
  id: "t1",
  proposerId: "me",
  recipientId: "f1",
  proposerGives: ["A1"],
  proposerGets: ["B1", "B2"],
  status: "pending",
  proposerConfirmedAt: null,
  recipientConfirmedAt: null,
  message: null,
  createdAt: 100,
  updatedAt: 100,
  completedAt: null,
  ...overrides
});

beforeEach(async () => {
  _resetDb();
  await initSchema();
});

describe("data/trades", () => {
  it("upserts and gets by id with array roundtrip", async () => {
    await upsertTrade(t({}));
    const got = await getTradeById("t1");
    expect(got?.proposerGives).toEqual(["A1"]);
    expect(got?.proposerGets).toEqual(["B1", "B2"]);
    expect(got?.status).toBe("pending");
  });

  it("upsert overwrites existing trade", async () => {
    await upsertTrade(t({ status: "pending" }));
    await upsertTrade(t({ status: "accepted", updatedAt: 200 }));
    const got = await getTradeById("t1");
    expect(got?.status).toBe("accepted");
    expect(got?.updatedAt).toBe(200);
  });

  it("listActiveTrades returns pending and accepted, not completed/declined/cancelled", async () => {
    await upsertTrade(t({ id: "t1", status: "pending" }));
    await upsertTrade(t({ id: "t2", status: "accepted" }));
    await upsertTrade(t({ id: "t3", status: "completed" }));
    await upsertTrade(t({ id: "t4", status: "declined" }));
    await upsertTrade(t({ id: "t5", status: "cancelled" }));
    const r = await listActiveTrades();
    expect(r.map((x) => x.id).sort()).toEqual(["t1", "t2"]);
  });

  it("getActiveTradeForFriend matches both proposer and recipient sides", async () => {
    await upsertTrade(t({ id: "out", proposerId: "me", recipientId: "f1", status: "pending" }));
    await upsertTrade(t({ id: "in",  proposerId: "f2", recipientId: "me", status: "accepted" }));
    expect((await getActiveTradeForFriend("me", "f1"))?.id).toBe("out");
    expect((await getActiveTradeForFriend("me", "f2"))?.id).toBe("in");
    expect(await getActiveTradeForFriend("me", "ghost")).toBeNull();
  });

  it("getActiveTradeForFriend returns null for completed/cancelled", async () => {
    await upsertTrade(t({ id: "done", proposerId: "me", recipientId: "f1", status: "completed" }));
    expect(await getActiveTradeForFriend("me", "f1")).toBeNull();
  });

  it("removeTrade deletes the row", async () => {
    await upsertTrade(t({}));
    await removeTrade("t1");
    expect(await getTradeById("t1")).toBeNull();
  });
});
