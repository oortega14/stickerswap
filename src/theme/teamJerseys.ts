// src/theme/teamJerseys.ts
//
// Diseños de camiseta custom por equipo. Si un equipo aparece acá,
// `StickerCardVisual` usa estos valores en lugar de derivar la camiseta de
// `teamColors` (que representa colores de bandera, no necesariamente de
// camiseta). Permite franjas, colores específicos, y ajustar posición de
// iniciales.

export type JerseyStripesLayout =
  | "side-vertical"      // 3+ franjas verticales finas pegadas al borde izquierdo (Adidas-style)
  | "chest-horizontal"   // franjas finas sobre el pecho
  | "full-horizontal"    // franjas gruesas en mid-torso
  | "full-vertical";     // franjas verticales que ocupan todo el body (Argentina/Croatia)

export interface JerseyStripes {
  layout: JerseyStripesLayout;
  colors: string[]; // 2+ colores en orden de aparición
}

export interface JerseyDesign {
  body: string;
  sleeves: string;
  // Color de las iniciales sobre el body. Default: el `bgText` del teamColors
  // (se aplica solo si no se especifica acá).
  initialsColor?: string;
  // Desplazamiento horizontal de las iniciales desde el centro (x=50).
  // Positivo = derecha, negativo = izquierda. Útil cuando hay franjas que
  // cubren el centro de la camiseta.
  initialsXOffset?: number;
  stripes?: JerseyStripes;
}

const JERSEYS: Record<string, JerseyDesign> = {
  GER: {
    body: "#FFFFFF",
    sleeves: "#000000",
    initialsColor: "#000000",
    initialsXOffset: 6,
    stripes: {
      layout: "side-vertical",
      colors: ["#000000", "#DD0000", "#FFCC00"]
    }
  },
  ALG: {
    body: "#FFFFFF",
    sleeves: "#006233",
    initialsColor: "#000000",
    initialsXOffset: 6,
    stripes: {
      layout: "side-vertical",
      colors: ["#FFFFFF", "#006233", "#D21034"]
    }
  },
  ARG: {
    body: "#FFFFFF",
    sleeves: "#75AADB",
    initialsColor: "#0A2240",
    initialsXOffset: 6,
    stripes: {
      layout: "side-vertical",
      colors: ["#FFFFFF", "#75AADB", "#0A2240"]
    }
  }
};

export function getTeamJersey(code: string | null | undefined): JerseyDesign | null {
  if (!code) return null;
  return JERSEYS[code.toUpperCase()] ?? null;
}
