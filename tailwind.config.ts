import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Light mode: clean white base, dark green as the identity colour.
        surface: "#FFFFFF",
        "surface-alt": "#F6F8F7",
        ink: "#0C2A22",
        "ink-soft": "#415B52",
        forest: {
          DEFAULT: "#0B5E42",
          dark: "#073F2C",
          light: "#12805A",
        },
        gold: "#B08D57",
        hairline: "#DCE5E1",
        brick: "#9B4030",
        // Dark mode surfaces
        "dark-surface": "#0A1714",
        "dark-surface-alt": "#102420",
        "dark-ink": "#E8F0EC",
        "dark-hairline": "#1E3830",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        arabic: ["var(--font-amiri)", "Traditional Arabic", "serif"],
      },
      borderRadius: { DEFAULT: "4px" },
    },
  },
  plugins: [],
};

export default config;
