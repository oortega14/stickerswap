// Mapa estático código FIFA → emoji bandera para los 48 equipos del
// Mundial 2026. Los emojis son secuencias de Regional Indicator Symbols
// (o subtag para ENG/SCO) que renderizan en iOS 14+ y Android 11+.
export const FIFA_TO_FLAG: Record<string, string> = {
  ALG: "🇩🇿", ARG: "🇦🇷", AUS: "🇦🇺", AUT: "🇦🇹",
  BEL: "🇧🇪", BIH: "🇧🇦", BRA: "🇧🇷", CAN: "🇨🇦",
  CIV: "🇨🇮", COD: "🇨🇩", COL: "🇨🇴", CPV: "🇨🇻",
  CRO: "🇭🇷", CUW: "🇨🇼", CZE: "🇨🇿", ECU: "🇪🇨",
  EGY: "🇪🇬", ENG: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", ESP: "🇪🇸", FRA: "🇫🇷",
  GER: "🇩🇪", GHA: "🇬🇭", HAI: "🇭🇹", IRN: "🇮🇷",
  IRQ: "🇮🇶", JOR: "🇯🇴", JPN: "🇯🇵", KOR: "🇰🇷",
  KSA: "🇸🇦", MAR: "🇲🇦", MEX: "🇲🇽", NED: "🇳🇱",
  NOR: "🇳🇴", NZL: "🇳🇿", PAN: "🇵🇦", PAR: "🇵🇾",
  POR: "🇵🇹", QAT: "🇶🇦", RSA: "🇿🇦", SCO: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  SEN: "🇸🇳", SUI: "🇨🇭", SWE: "🇸🇪", TUN: "🇹🇳",
  TUR: "🇹🇷", URU: "🇺🇾", USA: "🇺🇸", UZB: "🇺🇿"
};

export function flagFor(fifaCode: string | null | undefined): string {
  if (!fifaCode) return "";
  return FIFA_TO_FLAG[fifaCode] ?? "";
}
