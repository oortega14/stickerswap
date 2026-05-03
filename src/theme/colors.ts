export const colors = {
  black: "#000000",
  deep: "#0a0820",
  dark: "#16142e",
  mid: "#1c1648",
  purple: "#7c5cff",
  violet: "#a78bfa",
  blue: "#3b82f6",
  sky: "#60a5fa",
  ink: "#e8e6ff",
  mute: "#a59cdf",
  dim: "#8b86c4"
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
