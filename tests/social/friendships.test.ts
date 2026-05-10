/**
 * @jest-environment node
 */
jest.mock("expo-sqlite", () => require("../setup-sqlite-mock").createSqliteMock());

const mockRpc = jest.fn();
const mockFrom = jest.fn((table: string) => {
  if (table === "profiles") {
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: { username: "alice" }, error: null })
        })
      })
    };
  }
  return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
});

jest.mock("@/auth/supabaseClient", () => ({
  supabase: {
    rpc: (name: string, params?: unknown) => mockRpc(name, params),
    from: (table: string) => mockFrom(table)
  } as unknown
}));

import { addFriendByCode, findUserByUsername } from "@/social/friendships";
import { _resetForTest as resetRecentScans } from "@/social/recentScans";
import "../setup-sqlite-mock";
import { initSchema } from "@/data/schema";
import { _resetDb } from "@/data/db";

beforeEach(async () => {
  _resetDb();
  await initSchema();
  mockRpc.mockReset();
  resetRecentScans();
});

it("addFriendByCode calls accept_invite_code RPC y resuelve username", async () => {
  mockRpc.mockResolvedValueOnce({ data: "user-uuid", error: null });
  const result = await addFriendByCode("AB12CD34");
  expect(mockRpc).toHaveBeenCalledWith("accept_invite_code", { code: "AB12CD34" });
  expect(result).toEqual({ id: "user-uuid", username: "alice" });
});

it("findUserByUsername returns first match", async () => {
  mockRpc.mockResolvedValueOnce({
    data: [{ id: "u1", username: "juli", display_name: null, avatar_url: null }],
    error: null
  });
  const u = await findUserByUsername("juli");
  expect(u?.id).toBe("u1");
});

it("findUserByUsername returns null when empty", async () => {
  mockRpc.mockResolvedValueOnce({ data: [], error: null });
  const u = await findUserByUsername("ghost");
  expect(u).toBeNull();
});
