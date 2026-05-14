// Mapa estático código FIFA → letra de grupo (A-L) del Mundial 2026.
// Fuente de verdad: scripts/gen-stickers.js. Si cambia el orden o los
// equipos del álbum, actualizar acá.

const TEAM_GROUPS: Record<string, string> = {
  // A
  MEX: "A", RSA: "A", KOR: "A", CZE: "A",
  // B
  CAN: "B", BIH: "B", QAT: "B", SUI: "B",
  // C
  BRA: "C", MAR: "C", HAI: "C", SCO: "C",
  // D
  USA: "D", PAR: "D", AUS: "D", TUR: "D",
  // E
  GER: "E", CUW: "E", CIV: "E", ECU: "E",
  // F
  NED: "F", JPN: "F", SWE: "F", TUN: "F",
  // G
  BEL: "G", EGY: "G", IRN: "G", NZL: "G",
  // H
  ESP: "H", CPV: "H", KSA: "H", URU: "H",
  // I
  FRA: "I", SEN: "I", IRQ: "I", NOR: "I",
  // J
  ARG: "J", ALG: "J", AUT: "J", JOR: "J",
  // K
  POR: "K", COD: "K", UZB: "K", COL: "K",
  // L
  ENG: "L", CRO: "L", GHA: "L", PAN: "L"
};

export function getTeamGroup(code: string | null | undefined): string | null {
  if (!code) return null;
  return TEAM_GROUPS[code] ?? null;
}
