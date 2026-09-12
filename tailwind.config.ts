import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ivory: "#FBF7EE",
        ink: "#0F2A24",
        emerald: {
          DEFAULT: "#0B6E4F",
          dark: "#084B36",
        },
        gold: "#B08D57",
        hairline: "#DDD3BE",
        brick: "#9B4030",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        arabic: ["var(--font-amiri)", "Traditional Arabic", "serif"],
      },
      borderRadius: {
        DEFAULT: "4px",
      },
    },
  },
  plugins: [],
};

export default config;
