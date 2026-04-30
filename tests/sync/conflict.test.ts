import { resolveConflict } from "@/sync/conflict";

describe("resolveConflict", () => {
  it("returns remote when remote.updatedAt > local.updatedAt", () => {
    const local = { count: 2, updatedAt: 100 };
    const remote = { count: 5, updatedAt: 200 };
    expect(resolveConflict(local, remote)).toEqual(remote);
  });

  it("returns local when local.updatedAt > remote.updatedAt", () => {
    const local = { count: 7, updatedAt: 200 };
    const remote = { count: 3, updatedAt: 100 };
    expect(resolveConflict(local, remote)).toEqual(local);
  });

  it("returns remote on tie (server wins)", () => {
    const local = { count: 1, updatedAt: 100 };
    const remote = { count: 9, updatedAt: 100 };
    expect(resolveConflict(local, remote)).toEqual(remote);
  });

  it("returns remote when local is null", () => {
    expect(resolveConflict(null, { count: 1, updatedAt: 1 })).toEqual({ count: 1, updatedAt: 1 });
  });

  it("returns local when remote is null", () => {
    expect(resolveConflict({ count: 1, updatedAt: 1 }, null)).toEqual({ count: 1, updatedAt: 1 });
  });
});
