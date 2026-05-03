// Paleta curada por equipo: 5 colores reales de la bandera mapeados a slots
// concretos de la página. La página de equipo usa estos directamente, sin
// derivación algorítmica.

export interface TeamColors {
  bg: string;          // fondo de la página y del header
  surface: string;     // fondo de la card "pegada"
  bgText: string;      // texto sobre `bg` (header, falta state, "Volver")
  surfaceText: string; // texto sobre `surface` (pegada, ×N badge fg)
  accent: string;      // ✓ check (sobre surface), label JUGADORES (sobre bg), fin del gradient del ProgressBar
}

const DEFAULT: TeamColors = {
  bg: "#7c5cff",
  surface: "#3b82f6",
  bgText: "#ffffff",
  surfaceText: "#ffffff",
  accent: "#a78bfa"
};

const TEAM_COLORS: Record<string, TeamColors> = {
  ARG: { bg: "#75AADB", surface: "#ffffff", bgText: "#0a2240", surfaceText: "#0a2240", accent: "#f4c542" },
  BRA: { bg: "#009b3a", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#009b3a", accent: "#fdc41e" },
  USA: { bg: "#3c3b6e", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#3c3b6e", accent: "#b22234" },
  MEX: { bg: "#006847", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#006847", accent: "#ce1126" },
  CAN: { bg: "#d52b1e", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#d52b1e", accent: "#000000" },
  ESP: { bg: "#aa151b", surface: "#f1bf00", bgText: "#ffffff", surfaceText: "#aa151b", accent: "#ffffff" },
  FRA: { bg: "#0055a4", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#0055a4", accent: "#ef4135" },
  ENG: { bg: "#ce1124", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#ce1124", accent: "#002868" },
  GER: { bg: "#000000", surface: "#dd0000", bgText: "#ffffff", surfaceText: "#ffffff", accent: "#ffcc00" },
  POR: { bg: "#006600", surface: "#ff0000", bgText: "#ffffff", surfaceText: "#ffffff", accent: "#ffd700" },
  ITA: { bg: "#008c45", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#008c45", accent: "#cd212a" },
  NED: { bg: "#ff6c00", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#ff6c00", accent: "#21468b" },
  BEL: { bg: "#000000", surface: "#fae042", bgText: "#ffffff", surfaceText: "#000000", accent: "#ed2939" },
  CRO: { bg: "#ff0000", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#ff0000", accent: "#171796" },
  URU: { bg: "#7b9ce1", surface: "#ffffff", bgText: "#0a2240", surfaceText: "#0a2240", accent: "#f4c542" },
  COL: { bg: "#ffcd00", surface: "#003893", bgText: "#0a2240", surfaceText: "#ffffff", accent: "#ce1126" },
  ECU: { bg: "#ffd100", surface: "#034ea2", bgText: "#0a2240", surfaceText: "#ffffff", accent: "#ce1126" },
  PAR: { bg: "#d52b1e", surface: "#0038a8", bgText: "#ffffff", surfaceText: "#ffffff", accent: "#ffffff" },
  CHI: { bg: "#d52b1e", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#d52b1e", accent: "#0039a6" },
  PER: { bg: "#d91023", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#d91023", accent: "#d4a000" },
  JPN: { bg: "#ffffff", surface: "#bc002d", bgText: "#000000", surfaceText: "#ffffff", accent: "#bc002d" },
  KOR: { bg: "#ffffff", surface: "#cd2e3a", bgText: "#000000", surfaceText: "#ffffff", accent: "#0047a0" },
  AUS: { bg: "#012169", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#012169", accent: "#e4002b" },
  IRN: { bg: "#239f40", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#239f40", accent: "#da0000" },
  KSA: { bg: "#006c35", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#006c35", accent: "#c8a951" },
  QAT: { bg: "#8a1538", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#8a1538", accent: "#ffffff" },
  IRQ: { bg: "#ce1126", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#ce1126", accent: "#000000" },
  JOR: { bg: "#000000", surface: "#ce1126", bgText: "#ffffff", surfaceText: "#ffffff", accent: "#007a3d" },
  UZB: { bg: "#0099b5", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#0099b5", accent: "#1eb53a" },
  MAR: { bg: "#c1272d", surface: "#006233", bgText: "#ffffff", surfaceText: "#ffffff", accent: "#ffffff" },
  SEN: { bg: "#00853f", surface: "#fdef42", bgText: "#ffffff", surfaceText: "#00853f", accent: "#cd1f2a" },
  EGY: { bg: "#ce1126", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#ce1126", accent: "#c8a951" },
  TUN: { bg: "#e70013", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#e70013", accent: "#ffffff" },
  ALG: { bg: "#006233", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#006233", accent: "#d21034" },
  GHA: { bg: "#ce1126", surface: "#fcd116", bgText: "#ffffff", surfaceText: "#000000", accent: "#006b3f" },
  CIV: { bg: "#f77f00", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#f77f00", accent: "#009e60" },
  CMR: { bg: "#007a5e", surface: "#ce1126", bgText: "#ffffff", surfaceText: "#ffffff", accent: "#fcd116" },
  RSA: { bg: "#007a4d", surface: "#ffb612", bgText: "#ffffff", surfaceText: "#000000", accent: "#de3831" },
  CPV: { bg: "#003893", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#003893", accent: "#cf2027" },
  COD: { bg: "#007fff", surface: "#f7d518", bgText: "#ffffff", surfaceText: "#003893", accent: "#ce1021" },
  BFA: { bg: "#ce1126", surface: "#009e49", bgText: "#ffffff", surfaceText: "#ffffff", accent: "#fcd116" },
  NGA: { bg: "#008751", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#008751", accent: "#ffffff" },
  CRC: { bg: "#002b7f", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#002b7f", accent: "#ce1126" },
  PAN: { bg: "#005aa7", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#005aa7", accent: "#d21034" },
  JAM: { bg: "#009b3a", surface: "#fed100", bgText: "#ffffff", surfaceText: "#000000", accent: "#000000" },
  HAI: { bg: "#0072ce", surface: "#d21034", bgText: "#ffffff", surfaceText: "#ffffff", accent: "#ffffff" },
  CUW: { bg: "#002b7f", surface: "#f9e814", bgText: "#ffffff", surfaceText: "#002b7f", accent: "#ffffff" },
  NZL: { bg: "#012169", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#012169", accent: "#c8102e" },
  SUI: { bg: "#d52b1e", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#d52b1e", accent: "#000000" },
  AUT: { bg: "#ed2939", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#ed2939", accent: "#000000" },
  POL: { bg: "#ffffff", surface: "#dc143c", bgText: "#0a2240", surfaceText: "#ffffff", accent: "#dc143c" },
  CZE: { bg: "#11457e", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#11457e", accent: "#d7141a" },
  TUR: { bg: "#e30a17", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#e30a17", accent: "#ffffff" },
  SCO: { bg: "#005eb8", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#005eb8", accent: "#ffffff" },
  NOR: { bg: "#ef2b2d", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#002868", accent: "#002868" },
  SWE: { bg: "#006aa7", surface: "#fecc00", bgText: "#fecc00", surfaceText: "#006aa7", accent: "#fecc00" },
  DEN: { bg: "#c8102e", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#c8102e", accent: "#ffffff" },
  HUN: { bg: "#cd2a3e", surface: "#ffffff", bgText: "#ffffff", surfaceText: "#cd2a3e", accent: "#436f4d" },
  UKR: { bg: "#005bbb", surface: "#ffd500", bgText: "#ffd500", surfaceText: "#005bbb", accent: "#ffd500" },
  BIH: { bg: "#002395", surface: "#fecb00", bgText: "#ffffff", surfaceText: "#002395", accent: "#ffffff" }
};

export function getTeamColors(code: string | null | undefined): TeamColors {
  if (!code) return DEFAULT;
  return TEAM_COLORS[code] ?? DEFAULT;
}
