import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg:        "#0a1020",
        "bg-2":    "#0f1729",
        surface:   "#131c30",
        "surface-2": "#18233c",
        "surface-3": "#1f2c49",
        border:    "rgba(255,255,255,.07)",
        "border-strong": "rgba(255,255,255,.14)",
        text:      "#eef2ff",
        "text-dim":"#a6b0c8",
        // text-mute: subido de #6b7490 (3.7:1) a #8a93b0 (~5.3:1) sobre bg-surface
        // para cumplir WCAG AA en texto pequeño (4.5:1 mínimo).
        "text-mute":"#8a93b0",
        primary:   "#10b981",
        "primary-2":"#059669",
        danger:    "#ef4444",
        warning:   "#f59e0b",
        info:      "#3b82f6",
        teamA:     "#3b82f6",
        teamB:     "#ef4444",
      },
      borderRadius: {
        sm: "10px",
        DEFAULT: "14px",
        md: "16px",
        lg: "20px",
        xl: "24px",
        "2xl": "28px",
        "3xl": "36px",
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,.04) inset, 0 10px 30px -12px rgba(0,0,0,.6)",
        pop:  "0 24px 60px -16px rgba(0,0,0,.6),0 8px 18px rgba(0,0,0,.35)",
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    }
  },
  plugins: []
};

export default config;
