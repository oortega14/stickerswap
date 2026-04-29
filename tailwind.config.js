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
          deep: "#0a0820",
          dark: "#16142e",
          mid: "#1c1648",
          purple: "#7c5cff",
          violet: "#a78bfa",
          blue: "#3b82f6",
          sky: "#60a5fa",
          ink: "#e8e6ff",
          mute: "#a59cdf",
          dim: "#8b86c4"
        }
      },
      fontFamily: {
        sans: ["System"]
      }
    }
  },
  plugins: []
};
