// Aproximación de los colores primarios de la bandera/equipo de cada selección.
// Usados para teñir el header y acentos en la página del equipo.

export interface TeamColors {
  primary: string;   // color principal (background del header, etc.)
  accent: string;    // color secundario (acentos, progreso)
  text: string;      // color de texto que contraste con primary ("#fff" o "#000")
}

const DEFAULT: TeamColors = {
  primary: "#7c5cff",
  accent: "#3b82f6",
  text: "#ffffff"
};

const TEAM_COLORS: Record<string, TeamColors> = {
  ARG: { primary: "#75AADB", accent: "#ffffff", text: "#0a2240" },
  BRA: { primary: "#fdc41e", accent: "#009b3a", text: "#0a2240" },
  USA: { primary: "#3c3b6e", accent: "#b22234", text: "#ffffff" },
  MEX: { primary: "#006847", accent: "#ce1126", text: "#ffffff" },
  CAN: { primary: "#d52b1e", accent: "#ffffff", text: "#ffffff" },
  ESP: { primary: "#aa151b", accent: "#f1bf00", text: "#ffffff" },
  FRA: { primary: "#0055a4", accent: "#ef4135", text: "#ffffff" },
  ENG: { primary: "#ce1124", accent: "#ffffff", text: "#ffffff" },
  GER: { primary: "#000000", accent: "#dd0000", text: "#ffffff" },
  POR: { primary: "#006600", accent: "#ff0000", text: "#ffffff" },
  ITA: { primary: "#008c45", accent: "#cd212a", text: "#ffffff" },
  NED: { primary: "#ae1c28", accent: "#21468b", text: "#ffffff" },
  BEL: { primary: "#fae042", accent: "#000000", text: "#0a2240" },
  CRO: { primary: "#171796", accent: "#ff0000", text: "#ffffff" },
  URU: { primary: "#7b9ce1", accent: "#ffd700", text: "#0a2240" },
  COL: { primary: "#ffcd00", accent: "#003893", text: "#0a2240" },
  ECU: { primary: "#ffd100", accent: "#034ea2", text: "#0a2240" },
  PAR: { primary: "#d52b1e", accent: "#0038a8", text: "#ffffff" },
  CHI: { primary: "#d52b1e", accent: "#0039a6", text: "#ffffff" },
  PER: { primary: "#d91023", accent: "#ffffff", text: "#ffffff" },
  JPN: { primary: "#bc002d", accent: "#ffffff", text: "#ffffff" },
  KOR: { primary: "#cd2e3a", accent: "#0047a0", text: "#ffffff" },
  AUS: { primary: "#fcd116", accent: "#00843d", text: "#0a2240" },
  IRN: { primary: "#239f40", accent: "#da0000", text: "#ffffff" },
  KSA: { primary: "#006c35", accent: "#ffffff", text: "#ffffff" },
  QAT: { primary: "#8a1538", accent: "#ffffff", text: "#ffffff" },
  IRQ: { primary: "#ce1126", accent: "#000000", text: "#ffffff" },
  JOR: { primary: "#000000", accent: "#ce1126", text: "#ffffff" },
  UZB: { primary: "#1eb53a", accent: "#0099b5", text: "#ffffff" },
  MAR: { primary: "#c1272d", accent: "#006233", text: "#ffffff" },
  SEN: { primary: "#00853f", accent: "#fdef42", text: "#ffffff" },
  EGY: { primary: "#ce1126", accent: "#000000", text: "#ffffff" },
  TUN: { primary: "#e70013", accent: "#ffffff", text: "#ffffff" },
  ALG: { primary: "#006233", accent: "#d21034", text: "#ffffff" },
  GHA: { primary: "#fcd116", accent: "#006b3f", text: "#0a2240" },
  CIV: { primary: "#f77f00", accent: "#009e60", text: "#ffffff" },
  CMR: { primary: "#007a5e", accent: "#ce1126", text: "#ffffff" },
  RSA: { primary: "#007a4d", accent: "#ffb612", text: "#ffffff" },
  CPV: { primary: "#003893", accent: "#cf2027", text: "#ffffff" },
  COD: { primary: "#007fff", accent: "#f7d518", text: "#ffffff" },
  BFA: { primary: "#ce1126", accent: "#009e49", text: "#ffffff" },
  NGA: { primary: "#008751", accent: "#ffffff", text: "#ffffff" },
  CRC: { primary: "#002b7f", accent: "#ce1126", text: "#ffffff" },
  PAN: { primary: "#005aa7", accent: "#d21034", text: "#ffffff" },
  JAM: { primary: "#009b3a", accent: "#fed100", text: "#0a2240" },
  HAI: { primary: "#0072ce", accent: "#d21034", text: "#ffffff" },
  CUW: { primary: "#002b7f", accent: "#f9e814", text: "#ffffff" },
  NZL: { primary: "#012169", accent: "#c8102e", text: "#ffffff" },
  SUI: { primary: "#d52b1e", accent: "#ffffff", text: "#ffffff" },
  AUT: { primary: "#ed2939", accent: "#ffffff", text: "#ffffff" },
  POL: { primary: "#ffffff", accent: "#dc143c", text: "#0a2240" },
  CZE: { primary: "#11457e", accent: "#d7141a", text: "#ffffff" },
  TUR: { primary: "#e30a17", accent: "#ffffff", text: "#ffffff" },
  SCO: { primary: "#005eb8", accent: "#ffffff", text: "#ffffff" },
  NOR: { primary: "#ef2b2d", accent: "#002868", text: "#ffffff" },
  SWE: { primary: "#006aa7", accent: "#fecc00", text: "#ffffff" },
  DEN: { primary: "#c8102e", accent: "#ffffff", text: "#ffffff" },
  HUN: { primary: "#436f4d", accent: "#cd2a3e", text: "#ffffff" },
  UKR: { primary: "#005bbb", accent: "#ffd500", text: "#ffffff" },
  BIH: { primary: "#002395", accent: "#fecb00", text: "#ffffff" }
};

export function getTeamColors(code: string | null | undefined): TeamColors {
  if (!code) return DEFAULT;
  return TEAM_COLORS[code] ?? DEFAULT;
}
