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
          black: "rgb(var(--space-black) / <alpha-value>)",
          deep: "rgb(var(--space-deep) / <alpha-value>)",
          dark: "rgb(var(--space-dark) / <alpha-value>)",
          mid: "rgb(var(--space-mid) / <alpha-value>)",
          purple: "rgb(var(--space-purple) / <alpha-value>)",
          violet: "rgb(var(--space-violet) / <alpha-value>)",
          blue: "rgb(var(--space-blue) / <alpha-value>)",
          sky: "rgb(var(--space-sky) / <alpha-value>)",
          ink: "rgb(var(--space-ink) / <alpha-value>)",
          mute: "rgb(var(--space-mute) / <alpha-value>)",
          dim: "rgb(var(--space-dim) / <alpha-value>)"
        }
      },
      fontFamily: {
        sans: ["System"]
      }
    }
  },
  plugins: []
};
