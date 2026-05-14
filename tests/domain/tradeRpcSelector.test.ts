import { pickProposeRpc } from "@/domain/tradeRpcSelector";

describe("pickProposeRpc", () => {
  it("devuelve 'insert' cuando la amistad está aceptada", () => {
    expect(pickProposeRpc({ status: "accepted" })).toBe("insert");
  });

  it("devuelve 'combo' cuando no hay relación previa", () => {
    expect(pickProposeRpc(null)).toBe("combo");
  });

  it("devuelve 'combo' cuando la amistad está pending", () => {
    expect(pickProposeRpc({ status: "pending" })).toBe("combo");
  });

  it("tira error cuando la amistad está blocked", () => {
    expect(() => pickProposeRpc({ status: "blocked" })).toThrow("friendship_blocked");
  });

  it("tira error cuando la amistad está rejected", () => {
    expect(() => pickProposeRpc({ status: "rejected" })).toThrow("friendship_blocked");
  });
});
