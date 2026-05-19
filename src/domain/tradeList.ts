import type { Sticker, StickerStatus, TradeList, TradeListEntry } from "./types";
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


export function formatTradeListByTeam(
  list: TradeList,
  opts: {
    username: string | null;
    include?: { needed?: boolean; duplicates?: boolean };
  }
): string {
  if (list.needed.length === 0 && list.duplicates.length === 0) {
    return "Tu álbum está completo 🎉";
  }
  const includeNeeded = opts.include?.needed ?? true;
  const includeDuplicates = opts.include?.duplicates ?? true;

  const renderedNeeded = includeNeeded && list.needed.length > 0;
  const renderedDuplicates = includeDuplicates && list.duplicates.length > 0;
  if (!renderedNeeded && !renderedDuplicates) return "";

  const header = opts.username
    ? `stickerSwap · Mundial 2026 — @${opts.username}`
    : "stickerSwap · Mundial 2026";
  const lines: string[] = [header, ""];

  if (renderedNeeded) {
    lines.push("Me faltan*");
    lines.push(...renderBlock(list.needed));
  }
  if (renderedDuplicates) {
    if (renderedNeeded) lines.push("");
    lines.push("Tengo repes*");
    lines.push(...renderBlock(list.duplicates));
  }
  return lines.join("\n").trim();
}

function renderBlock(entries: TradeListEntry[]): string[] {
  // Agrupa por equipo (cuando hay team code) o por seccion (Intro/Extras/Coca-Cola).
  // Orden de los grupos = orden de album (por el numero mas chico de cada grupo).
  interface Group {
    label: string;
    teamCode: string | null;
    items: TradeListEntry[];
    minNumber: number;
  }

  const groups = new Map<string, Group>();
  for (const e of entries) {
    const isTeam = e.team != null;
    const key = isTeam ? `team:${e.team}` : `section:${e.section}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        label: isTeam ? (e.team as string) : e.section,
        teamCode: isTeam ? (e.team as string) : null,
        items: [],
        minNumber: e.number
      };
      groups.set(key, g);
    }
    g.items.push(e);
    if (e.number < g.minNumber) g.minNumber = e.number;
  }

  const sortedGroups = Array.from(groups.values()).sort(
    (a, b) => a.minNumber - b.minNumber
  );

  const out: string[] = [];
  for (const g of sortedGroups) {
    const items = g.items.slice().sort((a, b) => a.number - b.number);
    const right = items.map((e) => e.code).join(", ");
    if (g.teamCode) {
      const flag = flagFor(g.teamCode);
      const prefix = flag ? `${g.teamCode} ${flag}` : g.teamCode;
      out.push(`${prefix}: ${right}`);
    } else {
      out.push(`${g.label}: ${right}`);
    }
  }
  return out;
}

