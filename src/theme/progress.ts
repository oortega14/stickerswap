type Stops = {
  progressRed: string;
  progressAmber: string;
  progressGreen: string;
};

function parseHex(hex: string): [number, number, number] {
  const m = hex.match(/^#([0-9a-fA-F]{6})$/);
  if (!m) return [0, 0, 0];
  const h = m[1];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16)
  ];
}

function toHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Interpola linealmente en RGB entre tres stops:
 *  pct ≤ 0    → red
 *  pct = 0.5  → amber
 *  pct ≥ 1    → green
 *
 * Acepta `Theme` o cualquier objeto que tenga las 3 claves de progreso —
 * útil para tests sin tener que armar el theme completo.
 */
export function progressColor(pct: number, stops: Stops): string {
  if (pct <= 0) return stops.progressRed;
  if (pct >= 1) return stops.progressGreen;
  const [r1, g1, b1] = parseHex(stops.progressRed);
  const [r2, g2, b2] = parseHex(stops.progressAmber);
  const [r3, g3, b3] = parseHex(stops.progressGreen);
  if (pct < 0.5) {
    const t = pct / 0.5;
    return toHex(lerp(r1, r2, t), lerp(g1, g2, t), lerp(b1, b2, t));
  }
  const t = (pct - 0.5) / 0.5;
  return toHex(lerp(r2, r3, t), lerp(g2, g3, t), lerp(b2, b3, t));
}
