// Paleta legacy. Las claves se conservan para no romper consumidores
// (`colors.dim`, `colors.purple`, etc.), pero los valores se remapearon
// a la paleta cream/coffee del nuevo theme. Los nombres son misnombres
// post-cream — la limpieza completa es trabajo de seguimiento.
export const colors = {
  black: "#000000",
  deep: "#fdf6e3",     // bg crema (era space deep)
  dark: "#fffaf0",     // card off-white (era space dark)
  mid: "#f5e8c8",      // tan suave (era space mid)
  purple: "#6b4423",   // accent café oscuro (era purple)
  violet: "#8b6f47",   // café medio (era violet)
  blue: "#dc2626",     // rojo progress (era blue) — usado en algunos hilos visuales
  sky: "#16a34a",      // verde progress (era sky)
  ink: "#3a2e1a",      // texto principal (era ink)
  mute: "#8b6f47",     // texto mute = café medio (era mute)
  dim: "#a89472"       // texto dim = sand (era dim)
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

