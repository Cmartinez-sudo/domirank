import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg:               "rgb(var(--color-bg) / <alpha-value>)",
        "bg-2":           "rgb(var(--color-bg-2) / <alpha-value>)",
        surface:          "rgb(var(--color-surface) / <alpha-value>)",
        "surface-2":      "rgb(var(--color-surface-2) / <alpha-value>)",
        "surface-3":      "rgb(var(--color-surface-3) / <alpha-value>)",
        border:           "var(--color-border)",
        "border-strong":  "var(--color-border-strong)",
        text:             "rgb(var(--color-text) / <alpha-value>)",
        "text-dim":       "rgb(var(--color-text-dim) / <alpha-value>)",
        "text-mute":      "rgb(var(--color-text-mute) / <alpha-value>)",
        primary:          "rgb(var(--color-primary) / <alpha-value>)",
        "primary-2":      "rgb(var(--color-primary-2) / <alpha-value>)",
        "primary-ink":    "rgb(var(--color-primary-ink) / <alpha-value>)",
        danger:           "rgb(var(--color-danger) / <alpha-value>)",
        warning:          "rgb(var(--color-warning) / <alpha-value>)",
        info:             "rgb(var(--color-info) / <alpha-value>)",
        teamA:            "rgb(var(--color-team-a) / <alpha-value>)",
        "teamA-soft":     "rgb(var(--color-team-a-soft) / <alpha-value>)",
        teamB:            "rgb(var(--color-team-b) / <alpha-value>)",
        "teamB-soft":     "rgb(var(--color-team-b-soft) / <alpha-value>)",
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
        card: "var(--shadow-card)",
        pop:  "var(--shadow-pop)",
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    }
  },
  plugins: []
};

export default config;
