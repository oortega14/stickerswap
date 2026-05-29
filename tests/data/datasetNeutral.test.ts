import dataset from "../../assets/stickers.json";

type RawSticker = { code: string; section: string };

const stickers = dataset.stickers as RawSticker[];

describe("dataset neutrality (Apple 5.2.1)", () => {
  it("contains no FIFA-resembling codes", () => {
    const offending = stickers.filter(
      (s) => /^FWC/i.test(s.code) || /^CC\d/i.test(s.code) || s.code === "0-0"
    );
    expect(offending.map((s) => s.code)).toEqual([]);
  });

  it("uses neutral section prefixes for special sections", () => {
    const intro = stickers.filter((s) => s.section === "Intro");
    const extras = stickers.filter((s) => s.section === "Extras");
    const stars = stickers.filter((s) => s.section === "Estrellas");

    expect(intro.length).toBe(9);
    expect(extras.length).toBe(11);
    expect(stars.length).toBe(14);

    expect(intro.every((s) => /^INT-\d+$/.test(s.code))).toBe(true);
    expect(extras.every((s) => /^EXT-\d+$/.test(s.code))).toBe(true);
    expect(stars.every((s) => /^STR-\d+$/.test(s.code))).toBe(true);
  });

  it("keeps the full sticker count", () => {
    expect(stickers.length).toBe(994);
  });
});
