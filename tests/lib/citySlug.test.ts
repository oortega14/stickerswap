import { citySlug } from "@/lib/citySlug";

describe("citySlug", () => {
  it("lowercases and trims", () => {
    expect(citySlug("  ARMENIA  ")).toBe("armenia");
  });

  it("removes accents", () => {
    expect(citySlug("Bogotá")).toBe("bogota");
    expect(citySlug("São Paulo")).toBe("sao-paulo");
  });

  it("collapses internal spaces to hyphens", () => {
    expect(citySlug("San José de Cúcuta")).toBe("san-jose-de-cucuta");
  });

  it("strips non-alphanumeric except hyphens", () => {
    expect(citySlug("Quito #1!")).toBe("quito-1");
  });

  it("returns empty string for empty input", () => {
    expect(citySlug("")).toBe("");
    expect(citySlug("   ")).toBe("");
  });
});
