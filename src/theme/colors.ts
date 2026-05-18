// Paleta legacy. Las claves se conservan para no romper consumidores
// (`colors.dim`, `colors.purple`, etc.), pero los valores se remapearon
// a la paleta slate del theme actual. Los nombres son misnombres
// post-coffee — la limpieza completa es trabajo de seguimiento.
export const colors = {
  black: "#000000",
  deep: "#f1f5f9",     // slate-100 (bg light)
  dark: "#ffffff",     // white (card light)
  mid: "#e2e8f0",      // slate-200
  purple: "#334155",   // slate-700 (accent)
  violet: "#64748b",   // slate-500 (medio)
  blue: "#dc2626",     // rojo progress (sin cambios)
  sky: "#16a34a",      // verde progress (sin cambios)
  ink: "#0f172a",      // slate-900 (texto)
  mute: "#64748b",     // slate-500 (texto mute)
  dim: "#94a3b8"       // slate-400 (texto dim)
} as const;

export type ColorKey = keyof typeof colors;

/**
 * Convierte un hex color (#RRGGBB o #RGB) a rgba con la alpha dada.
 * Devuelve el input sin cambios si no parsea (ej. ya es rgba/named color).
 */
export function withAlpha(hex: string, alpha: number): string {
  const m = hex.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!m) return hex;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

