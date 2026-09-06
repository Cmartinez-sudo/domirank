/** @type {import('tailwindcss').Config} */
// Brand palette mirrors apps/web src/app/globals.css (:root and .light).
// Dark is the default DomiRank identity (deep navy + emerald); light theme
// values apply automatically via NativeWind's dark: variant driven by the OS
// setting (app.json > userInterfaceStyle: "automatic").
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Default (light) — matches PWA .light overrides
        bg: "#f8fafc",
        "bg-2": "#f1f5f9",
        surface: "#ffffff",
        "surface-2": "#f8fafc",
        "surface-3": "#f1f5f9",
        text: "#0f172a",
        "text-dim": "#475569",
        "text-mute": "#64748b",
        border: "#e2e8f0",
        primary: "#10b981",
        "primary-2": "#047857",
        "primary-ink": "#ffffff",
        danger: "#dc2626",

        // Dark variants exposed as bg-*-dark so we can use dark: prefix
        // in components (NativeWind v4 dark: variant reads OS scheme).
        "bg-dark": "#0a1020",
        "surface-dark": "#131c30",
        "surface-2-dark": "#18233c",
        "text-inverse": "#eef2ff",
        "text-dim-dark": "#a6b0c8",
      },
      borderRadius: {
        sm: "10px",
        DEFAULT: "14px",
        md: "16px",
        lg: "20px",
        xl: "24px",
      },
    },
  },
  plugins: [],
};
