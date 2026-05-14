import type { Sticker } from "./types";

export interface AlbumSection<S extends Sticker = Sticker> {
  /** Identificador estable para URLs. Para teams es el código FIFA, para
   *  especiales es el nombre de sección tal cual (Intro/Extras/Coca-Cola). */
  id: string;
  type: "team" | "special";
  name: string;
  teamCode: string | null;
  stickers: S[];
  minNumber: number;
}

/**
 * Agrupa los stickers por sección y devuelve la lista en orden de álbum
 * (el menor `number` de cada sección marca su posición; el dataset enumera
 * n=1..994 en orden de páginas del álbum). El id para teams es el código
 * FIFA y para especiales el nombre de sección.
 */
export function buildAlbumOrder<S extends Sticker>(stickers: S[]): AlbumSection<S>[] {
  const grouped = new Map<string, S[]>();
  for (const s of stickers) {
    const bucket = grouped.get(s.section);
    if (bucket) bucket.push(s);
    else grouped.set(s.section, [s]);
  }

  const sections: AlbumSection<S>[] = [];
  for (const [section, items] of grouped.entries()) {
    const sorted = [...items].sort((a, b) => a.number - b.number);
    const teamCode = sorted.find((s) => s.team !== null)?.team ?? null;
    const allSameTeam = teamCode !== null && sorted.every((s) => s.team === teamCode);
    sections.push({
      id: allSameTeam ? teamCode : section,
      type: allSameTeam ? "team" : "special",
      name: section,
      teamCode: allSameTeam ? teamCode : null,
      stickers: sorted,
      minNumber: sorted[0]?.number ?? Number.MAX_SAFE_INTEGER
    });
  }

  sections.sort((a, b) => a.minNumber - b.minNumber);
  return sections;
}

/**
 * Busca la sección cuyo `id` (team code) o `name` (sección en español)
 * matchea el identificador. Permite que las URLs `/album/MEX` y
 * `/album/México` apunten al mismo lugar.
 */
export function findSectionIndex<S extends Sticker>(
  order: AlbumSection<S>[],
  identifier: string
): number {
  if (!identifier) return -1;
  const idx = order.findIndex(
    (s) => s.id === identifier || s.name === identifier
  );
  return idx;
}
