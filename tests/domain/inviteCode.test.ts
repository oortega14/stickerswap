import { isValidInviteCode, normalizeInviteCode } from "@/domain/inviteCode";

describe("inviteCode", () => {
  it("accepts 8 hex uppercase", () => {
    expect(isValidInviteCode("AB12CD34")).toBe(true);
  });
  it("rejects wrong length", () => {
    expect(isValidInviteCode("ABC")).toBe(false);
    expect(isValidInviteCode("ABCDEFGHIJ")).toBe(false);
  });
  it("rejects non-hex chars", () => {
    expect(isValidInviteCode("ZZZZZZZZ")).toBe(false);
  });
  it("normalizes to upper and trims", () => {
    expect(normalizeInviteCode("  ab12cd34  ")).toBe("AB12CD34");
  });
});
