/**
 * @jest-environment node
 */
jest.mock("expo-sqlite", () => require("../setup-sqlite-mock").createSqliteMock());

import {
  cacheFriends,
  listCachedFriends,
  cacheMatches,
  listCachedMatchesForFriend,
  listAllCachedMatches,
  removeFriend
} from "@/data/friendsLocal";
import { initSchema } from "@/data/schema";
import { _resetDb } from "@/data/db";
import "../setup-sqlite-mock";

const fr = (id: string, username: string) => ({
  id,
  username,
  displayName: null,
  avatarUrl: null,
  status: "accepted" as const,
  source: "qr_code" as const,
  createdAt: 1
});

beforeEach(async () => {
  _resetDb();
  await initSchema();
});

describe("friendsLocal", () => {
  it("caches and lists friends", async () => {
    await cacheFriends([fr("f1", "juli"), fr("f2", "maria")]);
    const all = await listCachedFriends();
    expect(all).toHaveLength(2);
    expect(all.map((f) => f.username).sort()).toEqual(["juli", "maria"]);
  });

  it("upserts on re-cache", async () => {
    await cacheFriends([fr("f1", "juli")]);
    await cacheFriends([{ ...fr("f1", "juli"), displayName: "Juliana" }]);
    const all = await listCachedFriends();
    expect(all[0].displayName).toBe("Juliana");
  });

  it("caches matches and lists by friend", async () => {
    await cacheMatches("f1", [
      { friendId: "f1", stickerCode: "A1", extras: 2 },
      { friendId: "f1", stickerCode: "A2", extras: 1 }
    ]);
    const r = await listCachedMatchesForFriend("f1");
    expect(r).toHaveLength(2);
    const all = await listAllCachedMatches();
    expect(all).toHaveLength(2);
  });

  it("removeFriend cascades local cache rows", async () => {
    await cacheFriends([fr("f1", "juli")]);
    await cacheMatches("f1", [{ friendId: "f1", stickerCode: "A1", extras: 1 }]);
    await removeFriend("f1");
    expect(await listCachedFriends()).toHaveLength(0);
    expect(await listAllCachedMatches()).toHaveLength(0);
  });
});
