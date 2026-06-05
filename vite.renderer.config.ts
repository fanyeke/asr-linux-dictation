import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, "src/electron/renderer"),
  base: "./",
  build: {
    outDir: path.resolve(__dirname, "dist/electron/renderer"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, "src/electron/renderer/index.html"),
        overlay: path.resolve(__dirname, "src/electron/renderer/overlay.html"),
      },
    },
  },
});
