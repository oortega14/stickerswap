export interface Theme {
  bg: string;
  card: string;
  text: string;
  textMute: string;
  border: string;
  track: string;
  accent: string;
  progressRed: string;
  progressAmber: string;
  progressGreen: string;
}

// Paleta basada en Tailwind slate.
// Light: bg slate-100, card blanco, text slate-900, mute slate-500.
// Dark:  bg slate-800, card slate-700, text slate-100, mute slate-400.
export const lightTheme: Theme = {
  bg: "#f1f5f9",                    // slate-100
  card: "#ffffff",                  // white
  text: "#0f172a",                  // slate-900
  textMute: "#64748b",              // slate-500
  border: "rgba(15,23,42,0.10)",    // slate-900 @ 10%
  track: "rgba(15,23,42,0.10)",
  accent: "#334155",                // slate-700
  progressRed: "#dc2626",
  progressAmber: "#f59e0b",
  progressGreen: "#16a34a"
};

export const darkTheme: Theme = {
  bg: "#1e293b",                    // slate-800
  card: "#334155",                  // slate-700
  text: "#f1f5f9",                  // slate-100
  textMute: "#94a3b8",              // slate-400
  border: "rgba(241,245,249,0.10)", // slate-100 @ 10%
  track: "rgba(241,245,249,0.12)",
  accent: "#cbd5e1",                // slate-300
  progressRed: "#ef4444",
  progressAmber: "#f59e0b",
  progressGreen: "#22c55e"
};
