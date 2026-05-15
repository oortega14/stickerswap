import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FIFA_TO_FLAG, flagFor } from "@/domain/teamFlags";

describe("teamFlags", () => {
  it("incluye una bandera para los 48 códigos FIFA del dataset", () => {
    const raw = readFileSync(join(__dirname, "..", "..", "assets", "stickers.json"), "utf8");
    const data: { stickers: { team: string | null }[] } = JSON.parse(raw);
    const codes = new Set(
      data.stickers.map((s) => s.team).filter((t): t is string => t != null)
    );
    expect(codes.size).toBe(48);
    for (const code of codes) {
      expect(FIFA_TO_FLAG[code]).toBeDefined();
      expect(FIFA_TO_FLAG[code].length).toBeGreaterThan(0);
    }
  });

  it("flagFor devuelve emoji para código conocido", () => {
    expect(flagFor("ARG")).toBe(FIFA_TO_FLAG.ARG);
    expect(flagFor("KOR")).toBe(FIFA_TO_FLAG.KOR);
  });

  it("flagFor devuelve string vacío para código desconocido o null", () => {
    expect(flagFor("XYZ")).toBe("");
    expect(flagFor(null)).toBe("");
    expect(flagFor(undefined)).toBe("");
  });
});
