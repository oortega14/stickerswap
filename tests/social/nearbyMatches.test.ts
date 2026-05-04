/**
 * @jest-environment node
 */
const mockFrom = jest.fn((_table: string) => ({
  select: jest.fn(() => Promise.resolve({ data: [], error: null }))
}));

jest.mock("@/auth/supabaseClient", () => ({
  supabase: {
    from: (table: string) => mockFrom(table)
  } as unknown
}));

import { mapNearbyRow, mapPendingRow } from "@/social/nearbyMatches";

describe("mapNearbyRow", () => {
  it("converts snake_case row from view to NearbyMatchRaw", () => {
    const row = {
      me_id: "u1",
      them_id: "u2",
      username: "maria",
      display_name: "María",
      city_label: "Armenia",
      they_have_i_need: 12,
      i_have_they_need: 8
    };
    expect(mapNearbyRow(row)).toEqual({
      themId: "u2",
      username: "maria",
      displayName: "María",
      cityLabel: "Armenia",
      theyHaveINeed: 12,
      iHaveTheyNeed: 8
    });
  });

  it("preserves null displayName", () => {
    const row = {
      me_id: "u1",
      them_id: "u2",
      username: "maria",
      display_name: null,
      city_label: "Armenia",
      they_have_i_need: 0,
      i_have_they_need: 0
    };
    expect(mapNearbyRow(row).displayName).toBeNull();
  });
});

describe("mapPendingRow", () => {
  it("converts row to PendingRequest with parsed timestamp", () => {
    const row = {
      requester_id: "u3",
      username: "juan",
      display_name: null,
      city_label: "Armenia",
      message: "vi que tenés Messi",
      source: "nearby_match" as const,
      created_at: "2026-05-03T17:00:00Z"
    };
    const out = mapPendingRow(row);
    expect(out.requesterId).toBe("u3");
    expect(out.message).toBe("vi que tenés Messi");
    expect(out.source).toBe("nearby_match");
    expect(out.createdAt).toBe(Date.parse("2026-05-03T17:00:00Z"));
  });
});
