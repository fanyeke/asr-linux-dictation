import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "../lib/i18n": path.resolve(__dirname, "src/electron/renderer/lib/i18n.ts"),
      "../lib/i18n.js": path.resolve(__dirname, "src/electron/renderer/lib/i18n.ts"),
      "../../lib/i18n": path.resolve(__dirname, "src/electron/renderer/lib/i18n.ts"),
      "../../lib/i18n.js": path.resolve(__dirname, "src/electron/renderer/lib/i18n.ts"),
      "./lib/i18n": path.resolve(__dirname, "src/electron/renderer/lib/i18n.ts"),
      "./lib/i18n.js": path.resolve(__dirname, "src/electron/renderer/lib/i18n.ts"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["tests/electron/**/*.test.{ts,tsx}", "src/electron/renderer/components/**/__tests__/*.test.{ts,tsx}"],
    setupFiles: [],
  },
});
