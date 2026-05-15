import type { Sticker, StickerStatus, TradeList, TradeListEntry, TradeFormatOptions } from "./types";
import { flagFor } from "./teamFlags";

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

const NON_TEAM_SECTION_ORDER = ["Intro", "Extras", "Coca-Cola"] as const;

export function formatTradeListByTeam(
  list: TradeList,
  opts: { username: string | null }
): string {
  if (list.needed.length === 0 && list.duplicates.length === 0) {
    return "Tu álbum está completo 🎉";
  }
  const header = opts.username
    ? `stickerSwap · Mundial 2026 — @${opts.username}`
    : "stickerSwap · Mundial 2026";
  const lines: string[] = [header, ""];

  if (list.needed.length > 0) {
    lines.push("Me faltan*");
    lines.push(...renderBlock(list.needed, "needed"));
  }
  if (list.duplicates.length > 0) {
    if (list.needed.length > 0) lines.push("");
    lines.push("Tengo repes*");
    lines.push(...renderBlock(list.duplicates, "duplicates"));
  }
  return lines.join("\n").trim();
}

function renderBlock(entries: TradeListEntry[], mode: "needed" | "duplicates"): string[] {
  const withTeam = entries.filter((e) => e.team != null);
  const withoutTeam = entries.filter((e) => e.team == null);

  const teamGroups = new Map<string, TradeListEntry[]>();
  for (const e of withTeam) {
    const key = e.team as string;
    if (!teamGroups.has(key)) teamGroups.set(key, []);
    teamGroups.get(key)!.push(e);
  }
  const teamCodes = Array.from(teamGroups.keys()).sort();

  const sectionGroups = new Map<string, TradeListEntry[]>();
  for (const e of withoutTeam) {
    if (!sectionGroups.has(e.section)) sectionGroups.set(e.section, []);
    sectionGroups.get(e.section)!.push(e);
  }

  const out: string[] = [];
  for (const code of teamCodes) {
    const items = teamGroups.get(code)!.slice().sort((a, b) => a.number - b.number);
    const right = items.map((e) => formatItem(e, mode)).join(", ");
    const flag = flagFor(code);
    const prefix = flag ? `${code} ${flag}` : code;
    out.push(`${prefix}: ${right}`);
  }
  for (const section of NON_TEAM_SECTION_ORDER) {
    const items = sectionGroups.get(section);
    if (!items || items.length === 0) continue;
    const sorted = items.slice().sort((a, b) => a.number - b.number);
    const right = sorted.map((e) => formatItem(e, mode)).join(", ");
    out.push(`${section}: ${right}`);
  }
  return out;
}

function formatItem(e: TradeListEntry, mode: "needed" | "duplicates"): string {
  if (mode === "needed") return String(e.number);
  const extras = e.count - 1;
  return `${e.number} ×${extras}`;
}
