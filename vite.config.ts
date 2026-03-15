import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import manifest from "./manifest.json";

export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest })],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@shared": resolve(__dirname, "./src/shared"),
      "@page": resolve(__dirname, "./src/page"),
      "@content": resolve(__dirname, "./src/content"),
      "@background": resolve(__dirname, "./src/background"),
      "@devtools": resolve(__dirname, "./src/devtools"),
      "@popup": resolve(__dirname, "./src/popup"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        devtools: resolve(__dirname, "src/devtools/devtools.html"),
        panel: resolve(__dirname, "src/devtools/panel.html"),
        popup: resolve(__dirname, "src/popup/popup.html"),
      },
    },
    // Target < 200KB for extension
    chunkSizeWarningLimit: 200,
  },
  // Test configuration handled by vitest.config.ts
});
