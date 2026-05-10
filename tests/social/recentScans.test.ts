import { markScanned, justScanned, _resetForTest } from "@/social/recentScans";

beforeEach(() => {
  _resetForTest();
});

it("recuerda IDs recién marcados", () => {
  markScanned("u1");
  expect(justScanned("u1")).toBe(true);
});

it("retorna false para IDs no marcados", () => {
  expect(justScanned("u1")).toBe(false);
});

it("expira la marca tras el TTL", () => {
  const realNow = Date.now;
  let now = 1_000_000;
  Date.now = () => now;
  try {
    markScanned("u1");
    expect(justScanned("u1")).toBe(true);
    now += 11_000;
    expect(justScanned("u1")).toBe(false);
  } finally {
    Date.now = realNow;
  }
});

it("mantiene marcas múltiples independientes", () => {
  markScanned("u1");
  markScanned("u2");
  expect(justScanned("u1")).toBe(true);
  expect(justScanned("u2")).toBe(true);
  expect(justScanned("u3")).toBe(false);
});

it("limpia entradas expiradas al consultarlas", () => {
  const realNow = Date.now;
  let now = 0;
  Date.now = () => now;
  try {
    markScanned("u1");
    now = 20_000;
    expect(justScanned("u1")).toBe(false);
    // Tras la consulta vencida, queda limpia: re-marcar y consultar ahora vale.
    markScanned("u1");
    expect(justScanned("u1")).toBe(true);
  } finally {
    Date.now = realNow;
  }
});
