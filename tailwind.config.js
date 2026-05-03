/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        space: {
          black: "#000000",
          deep: "#fdf6e3",
          dark: "#fffaf0",
          mid: "#f5e8c8",
          purple: "#6b4423",
          violet: "#8b6f47",
          blue: "#dc2626",
          sky: "#16a34a",
          ink: "#3a2e1a",
          mute: "#8b6f47",
          dim: "#a89472"
        }
      },
      fontFamily: {
        sans: ["System"]
      }
    }
  },
  plugins: []
};
