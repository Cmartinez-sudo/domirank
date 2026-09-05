import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    // Default environment for lib/ tests (no DOM needed)
    environment: "node",
    globals: false,
    // Exclude Playwright e2e tests from vitest
    exclude: ["**/node_modules/**", "e2e/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
