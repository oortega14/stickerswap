import { buildAlbumOrder, findSectionIndex } from "@/domain/albumOrder";
import type { Sticker } from "@/domain/types";

const sticker = (
  code: string,
  number: number,
  section: string,
  team: string | null
): Sticker => ({
  code,
  number,
  name: `n${number}`,
  team,
  section,
  type: team ? "player" : "icon"
});

describe("buildAlbumOrder", () => {
  it("agrupa por sección y ordena por menor número (Intro → equipos → especiales)", () => {
    const stickers: Sticker[] = [
      sticker("FWC-1", 1, "Intro", null),
      sticker("FWC-2", 2, "Intro", null),
      sticker("MEX-1", 10, "México", "MEX"),
      sticker("MEX-2", 11, "México", "MEX"),
      sticker("ARG-1", 50, "Argentina", "ARG"),
      sticker("EX-1", 970, "Extras", null),
      sticker("CC1", 981, "Coca-Cola", null)
    ];
    const order = buildAlbumOrder(stickers);
    expect(order.map((s) => s.id)).toEqual([
      "Intro",
      "MEX",
      "ARG",
      "Extras",
      "Coca-Cola"
    ]);
  });

  it("identifica tipo team vs special y expone teamCode", () => {
    const stickers: Sticker[] = [
      sticker("MEX-1", 10, "México", "MEX"),
      sticker("EX-1", 970, "Extras", null)
    ];
    const order = buildAlbumOrder(stickers);
    expect(order[0]).toMatchObject({
      id: "MEX",
      type: "team",
      name: "México",
      teamCode: "MEX"
    });
    expect(order[1]).toMatchObject({
      id: "Extras",
      type: "special",
      name: "Extras",
      teamCode: null
    });
  });

  it("incluye todos los stickers de la sección en order numérico", () => {
    const stickers: Sticker[] = [
      sticker("MEX-3", 12, "México", "MEX"),
      sticker("MEX-1", 10, "México", "MEX"),
      sticker("MEX-2", 11, "México", "MEX")
    ];
    const order = buildAlbumOrder(stickers);
    expect(order[0].stickers.map((s) => s.code)).toEqual(["MEX-1", "MEX-2", "MEX-3"]);
  });
});

describe("findSectionIndex", () => {
  const stickers: Sticker[] = [
    sticker("FWC-1", 1, "Intro", null),
    sticker("MEX-1", 10, "México", "MEX"),
    sticker("EX-1", 970, "Extras", null)
  ];
  const order = buildAlbumOrder(stickers);

  it("acepta team code FIFA", () => {
    expect(findSectionIndex(order, "MEX")).toBe(1);
  });
  it("acepta nombre de sección en español", () => {
    expect(findSectionIndex(order, "México")).toBe(1);
  });
  it("acepta nombre de sección para especiales", () => {
    expect(findSectionIndex(order, "Intro")).toBe(0);
    expect(findSectionIndex(order, "Extras")).toBe(2);
  });
  it("devuelve -1 cuando no encuentra", () => {
    expect(findSectionIndex(order, "Coca-Cola")).toBe(-1);
  });
});
