import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#148A7C",
          dark: "#0E6E62",
          soft: "#E4F2EF",
          softer: "#F1F8F6",
        },
        gold: {
          DEFAULT: "#E8B14A",
          soft: "#FBEFD4",
        },
        ink: "#0F1F1D",
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#F7F9F6",
        },
      },
      fontFamily: {
        sans: ["Instrument Sans", "DM Sans", "system-ui", "sans-serif"],
        serif: ["Fraunces", "Georgia", "serif"],
        arabic: ["Amiri", "serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
