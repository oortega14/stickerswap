import { ctaFor, nextStatus } from "@/domain/tradeStateMachine";
import type { Trade } from "@/domain/types";

const baseTrade = (overrides: Partial<Trade>): Trade => ({
  id: "t1",
  proposerId: "p1",
  recipientId: "r1",
  proposerGives: ["A1"],
  proposerGets: ["B1"],
  status: "pending",
  proposerConfirmedAt: null,
  recipientConfirmedAt: null,
  message: null,
  createdAt: 1,
  updatedAt: 1,
  completedAt: null,
  ...overrides
});

describe("nextStatus", () => {
  it("pending + accept → accepted", () => {
    expect(nextStatus("pending", "accept")).toBe("accepted");
  });
  it("pending + decline → declined", () => {
    expect(nextStatus("pending", "decline")).toBe("declined");
  });
  it("pending + cancel → cancelled", () => {
    expect(nextStatus("pending", "cancel")).toBe("cancelled");
  });
  it("accepted + confirm (one side) does not transition", () => {
    expect(nextStatus("accepted", "confirm")).toBe("accepted");
  });
  it("rejects invalid transitions", () => {
    expect(nextStatus("pending", "confirm")).toBe("invalid");
    expect(nextStatus("completed", "cancel")).toBe("invalid");
    expect(nextStatus("declined", "accept")).toBe("invalid");
  });
});

describe("ctaFor", () => {
  it("proposer + pending → waiting + cancel", () => {
    const t = baseTrade({ status: "pending" });
    const r = ctaFor("proposer", t);
    expect(r.kind).toBe("waiting");
    expect(r.secondaryAction).toBe("cancel");
  });

  it("recipient + pending → respond", () => {
    const t = baseTrade({ status: "pending" });
    const r = ctaFor("recipient", t);
    expect(r.kind).toBe("respond");
    expect(r.primaryAction).toBe("accept");
    expect(r.secondaryAction).toBe("decline");
  });

  it("accepted, no marks → mark_done", () => {
    const t = baseTrade({ status: "accepted" });
    const r = ctaFor("proposer", t);
    expect(r.kind).toBe("mark_done");
    expect(r.primaryAction).toBe("confirm");
  });

  it("accepted, only my mark → awaiting_other", () => {
    const t = baseTrade({ status: "accepted", proposerConfirmedAt: 1 });
    const r = ctaFor("proposer", t);
    expect(r.kind).toBe("awaiting_other");
    expect(r.secondaryAction).toBe("unconfirm");
  });

  it("accepted, only other's mark → confirm", () => {
    const t = baseTrade({ status: "accepted", recipientConfirmedAt: 1 });
    const r = ctaFor("proposer", t);
    expect(r.kind).toBe("confirm");
    expect(r.primaryAction).toBe("confirm");
  });

  it("completed within 24h → completed banner", () => {
    const now = Date.now();
    const t = baseTrade({ status: "completed", completedAt: now - 1000 });
    const r = ctaFor("proposer", t, now);
    expect(r.kind).toBe("completed");
  });

  it("completed >24h ago → none", () => {
    const now = Date.now();
    const t = baseTrade({ status: "completed", completedAt: now - 25 * 3600 * 1000 });
    const r = ctaFor("proposer", t, now);
    expect(r.kind).toBe("none");
  });

  it("declined / cancelled → none", () => {
    expect(ctaFor("proposer", baseTrade({ status: "declined" })).kind).toBe("none");
    expect(ctaFor("recipient", baseTrade({ status: "cancelled" })).kind).toBe("none");
  });
});
