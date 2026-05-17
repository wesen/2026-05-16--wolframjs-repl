import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  worker: {
    format: "es",
  },
  build: {
    target: "esnext",
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("node_modules/vega") || id.includes("node_modules/vega-embed") || id.includes("node_modules/vega-lite")) {
            return "vega";
          }
          if (id.includes("node_modules/katex")) {
            return "katex";
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      "@core": path.resolve(__dirname, "packages/core/src"),
      "@eval": path.resolve(__dirname, "packages/eval/src"),
      "@dataset": path.resolve(__dirname, "packages/dataset/src"),
      "@viz": path.resolve(__dirname, "packages/viz/src"),
      "@symbolic": path.resolve(__dirname, "packages/symbolic/src"),
      "@pattern": path.resolve(__dirname, "packages/pattern/src"),
      "@quantity": path.resolve(__dirname, "packages/quantity/src"),
      "@ui": path.resolve(__dirname, "packages/ui/src"),
      "@persistence": path.resolve(__dirname, "packages/persistence/src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: [],
  },
});
