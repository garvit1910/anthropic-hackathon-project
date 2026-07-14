import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Clinical dark workstation tokens (see globals.css :root).
        "bg-deep": "var(--bg-deep)",
        "bg-panel": "var(--bg-panel)",
        "bg-elev": "var(--bg-elev)",
        hairline: "var(--hairline)",
        vessel: "var(--vessel)",
        aneurysm: "var(--aneurysm)",
        accent: "var(--accent)",
        violet: "var(--violet)",
        path: "var(--path)",
        "wss-low": "var(--wss-low)",
        "wss-high": "var(--wss-high)",
        warn: "var(--warn)",
        "text-hi": "var(--text-hi)",
        "text-lo": "var(--text-lo)",
      },
      fontFamily: {
        // Technical grotesk for headings (Orbitron dropped), mono for data.
        display: ["var(--font-hero)", "system-ui", "sans-serif"],
        hero: ["var(--font-hero)", "var(--font-inter)", "sans-serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        // Subtle depth, no neon glow.
        glow: "0 0 0 1px var(--hairline)",
        "glow-vessel": "0 8px 24px -12px rgba(0,0,0,0.6)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.5s ease-out both",
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
