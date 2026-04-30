import { backoffMs, isStuck } from "@/sync/backoff";

describe("backoffMs", () => {
  it("schedule: 1s, 5s, 30s, 5min, then capped", () => {
    expect(backoffMs(0)).toBe(1_000);
    expect(backoffMs(1)).toBe(5_000);
    expect(backoffMs(2)).toBe(30_000);
    expect(backoffMs(3)).toBe(300_000);
    expect(backoffMs(4)).toBe(300_000);
    expect(backoffMs(9)).toBe(300_000);
  });
});

describe("isStuck", () => {
  it("true at 10 attempts", () => {
    expect(isStuck(9)).toBe(false);
    expect(isStuck(10)).toBe(true);
    expect(isStuck(20)).toBe(true);
  });
});
