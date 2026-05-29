import { buildAlbumOrder } from "@/domain/albumOrder";
import type { Sticker } from "@/domain/types";

const sticker = (
  code: string,
  number: number,
  section: string,
  team: string | null
): Sticker => ({
  code,
  number,
  team,
  section,
  type: team ? "player" : "icon"
});

describe("buildAlbumOrder", () => {
  it("agrupa por sección y ordena por menor número (Intro → equipos → especiales)", () => {
    const stickers: Sticker[] = [
      sticker("INT-1", 1, "Intro", null),
      sticker("INT-2", 2, "Intro", null),
      sticker("MEX-1", 10, "México", "MEX"),
      sticker("MEX-2", 11, "México", "MEX"),
      sticker("ARG-1", 50, "Argentina", "ARG"),
      sticker("EX-1", 970, "Extras", null),
      sticker("STR-1", 981, "Estrellas", null)
    ];
    const order = buildAlbumOrder(stickers);
    expect(order.map((s) => s.id)).toEqual([
      "Intro",
      "MEX",
      "ARG",
      "Extras",
      "Estrellas"
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
