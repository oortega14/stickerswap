/**
 * @jest-environment node
 */
jest.mock("expo-sqlite", () => require("../setup-sqlite-mock").createSqliteMock());

const mockRpc = jest.fn();
const mockFrom = jest.fn((_table: string) => ({
  select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) })
}));

jest.mock("@/auth/supabaseClient", () => ({
  supabase: {
    rpc: (name: string, params?: unknown) => mockRpc(name, params),
    from: (table: string) => mockFrom(table)
  } as unknown
}));

import { addFriendByCode, findUserByUsername } from "@/social/friendships";
import "../setup-sqlite-mock";
import { initSchema } from "@/data/schema";
import { _resetDb } from "@/data/db";

beforeEach(async () => {
  _resetDb();
  await initSchema();
  mockRpc.mockReset();
});

it("addFriendByCode calls accept_invite_code RPC", async () => {
  mockRpc.mockResolvedValueOnce({ data: "user-uuid", error: null });
  const id = await addFriendByCode("AB12CD34");
  expect(mockRpc).toHaveBeenCalledWith("accept_invite_code", { code: "AB12CD34" });
  expect(id).toBe("user-uuid");
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
