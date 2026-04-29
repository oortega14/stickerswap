import type {
  Sticker,
  StickerStatus,
  OverallProgress,
  SectionProgress
} from "./types";

export function computeProgress(
  stickers: Sticker[],
  statuses: StickerStatus[]
): OverallProgress {
  const statusMap = new Map(statuses.map((s) => [s.stickerCode, s.count]));

  let collected = 0;
  let duplicates = 0;
  const sectionTotals = new Map<string, { total: number; collected: number }>();

  for (const s of stickers) {
    const count = statusMap.get(s.code) ?? 0;
    const has = count >= 1 ? 1 : 0;
    if (has) collected += 1;
    if (count > 1) duplicates += count - 1;

    const acc = sectionTotals.get(s.section) ?? { total: 0, collected: 0 };
    acc.total += 1;
    acc.collected += has;
    sectionTotals.set(s.section, acc);
  }

  const bySection: SectionProgress[] = Array.from(sectionTotals.entries())
    .map(([section, v]) => ({
      section,
      total: v.total,
      collected: v.collected,
      pct: v.total === 0 ? 0 : v.collected / v.total
    }))
    .sort((a, b) => a.section.localeCompare(b.section));

  return {
    total: stickers.length,
    collected,
    pct: stickers.length === 0 ? 0 : collected / stickers.length,
    duplicates,
    bySection
  };
}
