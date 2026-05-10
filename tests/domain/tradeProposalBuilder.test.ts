import { buildDefaultProposal } from "@/domain/tradeProposalBuilder";
import type { BidirectionalMatch } from "@/domain/types";

const mkBidi = (
  they: { code: string; extras: number }[],
  you: { code: string; extras: number }[]
): BidirectionalMatch => ({
  theyHaveYouNeed: they.map((m) => ({ friendId: "f1", stickerCode: m.code, extras: m.extras })),
  youHaveTheyNeed: you.map((m) => ({ friendId: "f1", stickerCode: m.code, extras: m.extras }))
});

describe("buildDefaultProposal", () => {
  it("preselects all stickers from both sides", () => {
    const bidi = mkBidi(
      [{ code: "A1", extras: 1 }, { code: "A2", extras: 2 }],
      [{ code: "B1", extras: 1 }]
    );
    const r = buildDefaultProposal("f1", bidi);
    expect(r.recipientId).toBe("f1");
    expect(r.proposerGives).toEqual(["B1"]);
    expect(r.proposerGets).toEqual(["A1", "A2"]);
    expect(r.message).toBe("");
    expect(r.isValid).toBe(true);
    expect(r.invalidReason).toBeNull();
  });

  it("flags invalid when no gives", () => {
    const bidi = mkBidi([{ code: "A1", extras: 1 }], []);
    const r = buildDefaultProposal("f1", bidi);
    expect(r.proposerGives).toEqual([]);
    expect(r.isValid).toBe(false);
    expect(r.invalidReason).toBe("no_gives");
  });

  it("flags invalid when no gets", () => {
    const bidi = mkBidi([], [{ code: "B1", extras: 1 }]);
    const r = buildDefaultProposal("f1", bidi);
    expect(r.proposerGets).toEqual([]);
    expect(r.isValid).toBe(false);
    expect(r.invalidReason).toBe("no_gets");
  });

  it("is idempotent (calling twice produces equal result)", () => {
    const bidi = mkBidi([{ code: "A1", extras: 1 }], [{ code: "B1", extras: 1 }]);
    expect(buildDefaultProposal("f1", bidi)).toEqual(buildDefaultProposal("f1", bidi));
  });
});
