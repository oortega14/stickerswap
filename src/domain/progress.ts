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
  const sectionTotals = new Map<
    string,
    { total: number; collected: number; teamCode: string | null; minNumber: number }
  >();

  for (const s of stickers) {
    const count = statusMap.get(s.code) ?? 0;
    const has = count >= 1 ? 1 : 0;
    if (has) collected += 1;
    if (count > 1) duplicates += count - 1;

    const existing = sectionTotals.get(s.section);
    if (existing) {
      existing.total += 1;
      existing.collected += has;
      // Si algún sticker tiene team null, la sección no se asocia a un equipo.
      if (existing.teamCode !== null && s.team === null) {
        existing.teamCode = null;
      }
      if (s.number < existing.minNumber) existing.minNumber = s.number;
    } else {
      sectionTotals.set(s.section, {
        total: 1,
        collected: has,
        teamCode: s.team ?? null,
        minNumber: s.number
      });
    }
  }

  // Orden de álbum: el menor `number` de cada sección representa su posición
  // canónica en el álbum (el dataset enumera n=1..994 en orden de páginas).
  const bySection: SectionProgress[] = Array.from(sectionTotals.entries())
    .sort(([, a], [, b]) => a.minNumber - b.minNumber)
    .map(([section, v]) => ({
      section,
      total: v.total,
      collected: v.collected,
      pct: v.total === 0 ? 0 : v.collected / v.total,
      teamCode: v.teamCode
    }));

  return {
    total: stickers.length,
    collected,
    pct: stickers.length === 0 ? 0 : collected / stickers.length,
    duplicates,
    bySection
  };
}
