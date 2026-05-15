import type { Sticker, StickerStatus, TradeList, TradeListEntry, TradeFormatOptions } from "./types";

export function buildTradeList(stickers: Sticker[], statuses: StickerStatus[]): TradeList {
  const statusMap = new Map(statuses.map((s) => [s.stickerCode, s.count]));
  const needed: TradeListEntry[] = [];
  const duplicates: TradeListEntry[] = [];

  for (const s of stickers) {
    const count = statusMap.get(s.code) ?? 0;
    const entry: TradeListEntry = {
      code: s.code,
      number: s.number,
      section: s.section,
      team: s.team,
      count
    };
    if (count === 0) needed.push(entry);
    else if (count > 1) duplicates.push(entry);
  }

  needed.sort((a, b) => a.number - b.number);
  duplicates.sort((a, b) => a.number - b.number);
  return { needed, duplicates };
}

function groupBy<T>(items: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(it);
  }
  return m;
}

export function formatTradeListAsText(list: TradeList, opts: TradeFormatOptions): string {
  const lines: string[] = [];
  lines.push(`stickerSwap · Mundial 2026 — @${opts.username}`);
  lines.push("");

  if (list.needed.length > 0) {
    lines.push(`NECESITO (${list.needed.length}):`);
    if (opts.groupBySection) {
      const grouped = groupBy(list.needed, (e) => e.section);
      const sections = Array.from(grouped.keys()).sort(
        (a, b) => grouped.get(a)![0].number - grouped.get(b)![0].number
      );
      for (const sec of sections) {
        const nums = grouped.get(sec)!.map((e) => e.number).join(", ");
        lines.push(`• ${sec}: ${nums}`);
      }
    } else {
      const flat = [...list.needed]
        .sort((a, b) => a.number - b.number)
        .map((e) => e.number)
        .join(", ");
      lines[lines.length - 1] = `NECESITO: ${flat}`;
    }
    lines.push("");
  }

  if (list.duplicates.length > 0) {
    lines.push(`TENGO REPETIDAS (${list.duplicates.length}):`);
    if (opts.groupBySection) {
      const grouped = groupBy(list.duplicates, (e) => e.section);
      const sections = Array.from(grouped.keys()).sort(
        (a, b) => grouped.get(a)![0].number - grouped.get(b)![0].number
      );
      for (const sec of sections) {
        const items = grouped
          .get(sec)!
          .map((e) => `${e.number} (×${e.count - 1})`)
          .join(", ");
        lines.push(`• ${sec}: ${items}`);
      }
    } else {
      const flat = [...list.duplicates]
        .sort((a, b) => a.number - b.number)
        .map((e) => `${e.number} (×${e.count - 1})`)
        .join(", ");
      lines[lines.length - 1] = `TENGO REPE: ${flat}`;
    }
    lines.push("");
  }

  if (list.needed.length > 0 || list.duplicates.length > 0) {
    lines.push("Hablemos por aquí 👋");
  }

  return lines.join("\n").trim();
}
