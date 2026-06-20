import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Midnight Brass design system
        ink: { DEFAULT: "#16233A", 600: "#24365C", 700: "#0F1A2B" },
        slate2: "#334155",
        brass: { DEFAULT: "#B5894E", dark: "#8A6A38" },
        canvas: "#F7F8FA",
        surface: "#FFFFFF",
        hairline: "#E6E8EC",
        muted: "#64748B",
        // semantic money hues — used ONLY for money state
        paid: { DEFAULT: "#0E7C66", bg: "#E2F1ED" },
        due: { DEFAULT: "#B4541A", bg: "#FBEDE2" },
        danger: { DEFAULT: "#B42318", bg: "#FBEAE8" },
        inkbg: "#EEF1F6",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.06)",
        pop: "0 4px 12px rgba(16,24,40,.08)",
      },
      borderRadius: {
        DEFAULT: "6px",
        md: "8px",
        lg: "12px",
      },
    },
  },
  plugins: [],
};

export default config;
