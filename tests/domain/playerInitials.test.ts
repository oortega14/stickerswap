import { getInitials } from "@/domain/playerInitials";

describe("getInitials", () => {
  const cases: Array<[string | null | undefined, string]> = [
    ["Lionel Messi", "LM"],
    ["K. Mbappé", "KM"],
    ["Pedri", "PE"],
    ["Vinicius Jr", "VJ"],
    ["J.J. García", "JG"],
    ["van Dijk", "VD"],
    ["a", "A"],          // single char → uppercase
    ["", "??"],          // empty
    [null, "??"],        // null
    [undefined, "??"]    // undefined
  ];

  it.each(cases)("getInitials(%p) → %p", (input, expected) => {
    expect(getInitials(input as string)).toBe(expected);
  });

  it("uppercases the result", () => {
    expect(getInitials("kylian mbappé")).toBe("KM");
  });
});
