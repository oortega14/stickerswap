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
  },
  AUS: {
    body: "#FFC72C",
    sleeves: "#00843D",
    initialsColor: "#000000"
  },
  AUT: {
    body: "#ED2939",
    sleeves: "#000000",
    initialsColor: "#FFFFFF"
  },
  BEL: {
    body: "#EF3340",
    sleeves: "#000000",
    initialsColor: "#FFFFFF",
    initialsXOffset: 6,
    stripes: {
      layout: "side-vertical",
      colors: ["#000000", "#FAE042", "#EF3340"]
    }
  },
  BIH: {
    body: "#002F6C",
    sleeves: "#FECB00",
    initialsColor: "#FFFFFF"
  },
  BRA: {
    body: "#FDC41E",
    sleeves: "#009B3A",
    initialsColor: "#009B3A"
  },
  QAT: {
    body: "#8A1538",
    sleeves: "#8A1538",
    initialsColor: "#FFFFFF"
  },
  COL: {
    body: "#FCD116",
    sleeves: "#003893",
    initialsColor: "#003893",
    initialsXOffset: 6,
    stripes: {
      layout: "side-vertical",
      colors: ["#FCD116", "#003893", "#CE1126"]
    }
  },
  KOR: {
    body: "#6B3FA0",
    sleeves: "#6B3FA0",
    initialsColor: "#FFFFFF"
  },
  CIV: {
    body: "#FF8200",
    sleeves: "#009E60",
    initialsColor: "#FFFFFF"
  },
  CRO: {
    body: "#FFFFFF",
    sleeves: "#FF0000",
    initialsColor: "#171796",
    initialsXOffset: 6,
    stripes: {
      layout: "side-vertical",
      colors: ["#FF0000", "#FFFFFF", "#171796"]
    }
  },
  CUW: {
    body: "#002B7F",
    sleeves: "#002B7F",
    initialsColor: "#FFFFFF",
    stripes: {
      layout: "side-vertical",
      colors: ["#F9E300"]
    }
  },
  ECU: {
    body: "#FFCE00",
    sleeves: "#FFCE00",
    initialsColor: "#003893",
    initialsXOffset: 6,
    stripes: {
      layout: "side-vertical",
      colors: ["#003893", "#CE1126", "#003893"]
    }
  },
  SCO: {
    body: "#002B5C",
    sleeves: "#002B5C",
    initialsColor: "#FFFFFF",
    stripes: {
      layout: "side-vertical",
      colors: ["#FFFFFF"]
    }
  },
  ESP: {
    body: "#AA151B",
    sleeves: "#002868",
    initialsColor: "#F1BF00"
  },
  FRA: {
    body: "#0055A4",
    sleeves: "#0055A4",
    initialsColor: "#FFFFFF",
    initialsXOffset: 6,
    stripes: {
      layout: "side-vertical",
      colors: ["#0055A4", "#FFFFFF", "#EF4135"]
    }
  },
  GHA: {
    body: "#FFFFFF",
    sleeves: "#FFFFFF",
    initialsColor: "#000000",
    initialsXOffset: 6,
    stripes: {
      layout: "side-vertical",
      colors: ["#006B3F", "#FCD116", "#CE1126"]
    }
  },
  HAI: {
    body: "#FFFFFF",
    sleeves: "#00209F",
    initialsColor: "#00209F",
    initialsXOffset: 6,
    stripes: {
      layout: "side-vertical",
      colors: ["#00209F", "#D21034"]
    }
  },
  ENG: {
    body: "#FFFFFF",
    sleeves: "#002868",
    initialsColor: "#002868",
    initialsXOffset: 6,
    stripes: {
      layout: "side-vertical",
      colors: ["#CE1124", "#002868"]
    }
  },
  IRQ: {
    body: "#007A3D",
    sleeves: "#007A3D",
    initialsColor: "#FFFFFF",
    initialsXOffset: 6,
    stripes: {
      layout: "side-vertical",
      colors: ["#007A3D", "#CE1126", "#FFFFFF"]
    }
  },
  IRN: {
    body: "#FFFFFF",
    sleeves: "#239F40",
    initialsColor: "#239F40",
    initialsXOffset: 6,
    stripes: {
      layout: "side-vertical",
      colors: ["#239F40", "#FFFFFF", "#DA0000"]
    }
  }
};

export function getTeamJersey(code: string | null | undefined): JerseyDesign | null {
  if (!code) return null;
  return JERSEYS[code.toUpperCase()] ?? null;
}
