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
        // Derived from the CodePen palette; --bg-deep overridden to pure black per spec.
        "bg-deep": "var(--bg-deep)",
        "bg-panel": "var(--bg-panel)",
        vessel: "var(--vessel)",
        aneurysm: "var(--aneurysm)",
        accent: "var(--accent)",
        violet: "var(--violet)",
        path: "var(--path)",
        "wss-low": "var(--wss-low)",
        "wss-high": "var(--wss-high)",
        "text-hi": "var(--text-hi)",
        "text-lo": "var(--text-lo)",
      },
      fontFamily: {
        display: ["var(--font-orbitron)", "sans-serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px -6px var(--accent)",
        "glow-vessel": "0 0 28px -8px var(--vessel)",
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
