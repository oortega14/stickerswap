import type { StickerWithStatus } from "./types";

export type FilterMode = "all" | "missing" | "dup";

export function filterStickers(
  stickers: StickerWithStatus[],
  mode: FilterMode
): StickerWithStatus[] {
  switch (mode) {
    case "all":     return stickers;
    case "missing": return stickers.filter((s) => s.count === 0);
    case "dup":     return stickers.filter((s) => s.count > 1);
  }
}

export function countByFilter(
  stickers: StickerWithStatus[]
): { all: number; missing: number; dup: number } {
  let missing = 0;
  let dup = 0;
  for (const s of stickers) {
    if (s.count === 0) missing += 1;
    else if (s.count > 1) dup += 1;
  }
  return { all: stickers.length, missing, dup };
}
