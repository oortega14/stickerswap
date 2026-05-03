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

export const lightTheme: Theme = {
  bg: "#fdf6e3",
  card: "#fffaf0",
  text: "#3a2e1a",
  textMute: "#8b6f47",
  border: "rgba(58,46,26,0.10)",
  track: "rgba(58,46,26,0.10)",
  accent: "#6b4423",
  progressRed: "#dc2626",
  progressAmber: "#f59e0b",
  progressGreen: "#16a34a"
};
