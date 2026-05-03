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

/**
 * Devuelve una variante tonal de `hex`: si `text` es claro (white-ish)
 * asume que `hex` es oscuro y lo aclara; si `text` es oscuro asume `hex`
 * claro y lo oscurece. Sirve para diferenciar superficies con la misma
 * base sin perder contraste con el texto.
 */
export function tonalShift(hex: string, text: string, amount = 0.22): string {
  const m = hex.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!m) return hex;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  let r = parseInt(h.slice(0, 2), 16);
  let g = parseInt(h.slice(2, 4), 16);
  let b = parseInt(h.slice(4, 6), 16);
  const t = text.toLowerCase();
  const lightText = t === "#ffffff" || t === "#fff";
  if (lightText) {
    r = Math.min(255, Math.round(r + (255 - r) * amount));
    g = Math.min(255, Math.round(g + (255 - g) * amount));
    b = Math.min(255, Math.round(b + (255 - b) * amount));
  } else {
    r = Math.round(r * (1 - amount));
    g = Math.round(g * (1 - amount));
    b = Math.round(b * (1 - amount));
  }
  const hex2 = (n: number) => n.toString(16).padStart(2, "0");
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}
