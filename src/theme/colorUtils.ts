// src/theme/colorUtils.ts
//
// Helpers para derivar variantes de color a partir de hex strings:
// - `darkenHex` baja la luminosidad un % en espacio HSL.
// - `luminance` devuelve un número 0..1 (0 = negro, 1 = blanco) para
//   ramas condicionales tipo "si es muy oscuro, fallback a accent".
//
// Inputs aceptados: #rgb, #rrggbb, #rrggbbaa (alpha se ignora). Para
// inputs no parseables, ambas funciones devuelven valores defensivos
// (input sin cambios, o 0).

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  if (typeof hex !== "string" || !hex.startsWith("#")) return null;
  let h = hex.slice(1);
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (h.length !== 6 && h.length !== 8) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r, g, b };
}

function rgbToHsl(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case rn:
      h = (gn - bn) / d + (gn < bn ? 6 : 0);
      break;
    case gn:
      h = (bn - rn) / d + 2;
      break;
    case bn:
      h = (rn - gn) / d + 4;
      break;
  }
  return { h: h / 6, s, l };
}

function hslToRgb(h: number, s: number, l: number) {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function darkenHex(hex: string, amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const newL = Math.max(0, hsl.l - amount);
  const out = hslToRgb(hsl.h, hsl.s, newL);
  return rgbToHex(out.r, out.g, out.b);
}

export function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const sToLinear = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const r = sToLinear(rgb.r);
  const g = sToLinear(rgb.g);
  const b = sToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
