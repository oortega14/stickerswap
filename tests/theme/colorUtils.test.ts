import { darkenHex, luminance } from "@/theme/colorUtils";

describe("darkenHex", () => {
  it("darkens a light blue noticeably", () => {
    const out = darkenHex("#75AADB", 0.20);
    expect(out).toMatch(/^#[0-9a-f]{6}$/i);
    expect(luminance(out)).toBeLessThan(luminance("#75AADB"));
  });

  it("does not underflow on black", () => {
    expect(darkenHex("#000000", 0.20)).toBe("#000000");
  });

  it("darkens white into a gray", () => {
    const out = darkenHex("#ffffff", 0.20);
    expect(out).toMatch(/^#[0-9a-f]{6}$/i);
    expect(luminance(out)).toBeLessThan(0.95);
    expect(luminance(out)).toBeGreaterThan(0.5);
  });

  it("returns input unchanged on garbage", () => {
    expect(darkenHex("not-a-color", 0.20)).toBe("not-a-color");
    expect(darkenHex("#xyz", 0.20)).toBe("#xyz");
  });

  it("handles 3-char hex shortcuts", () => {
    const out = darkenHex("#abc", 0.20);
    expect(out).toMatch(/^#[0-9a-f]{6}$/i);
    expect(luminance(out)).toBeLessThan(luminance("#aabbcc"));
  });

  it("handles 8-char hex with alpha (drops alpha)", () => {
    const out = darkenHex("#75AADBff", 0.20);
    expect(out).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("luminance", () => {
  it("black is 0", () => {
    expect(luminance("#000000")).toBe(0);
  });

  it("white is 1", () => {
    expect(luminance("#ffffff")).toBe(1);
  });

  it("monotonic: darker = lower luminance", () => {
    expect(luminance("#000000")).toBeLessThan(luminance("#444444"));
    expect(luminance("#444444")).toBeLessThan(luminance("#888888"));
    expect(luminance("#888888")).toBeLessThan(luminance("#cccccc"));
  });

  it("returns 0 for invalid input", () => {
    expect(luminance("not-a-color")).toBe(0);
  });
});
