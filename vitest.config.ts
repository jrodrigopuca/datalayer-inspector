/// <reference types="vitest" />

import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.d.ts",
        "src/**/index.ts",
        "src/**/*.html",
      ],
      // Ratchet: set just below measured coverage and raised as tests land.
      // Never lower these to make a red build green (docs/TECH-DEBT.md, item 1).
      thresholds: {
        branches: 39,
        functions: 27,
        lines: 43,
        statements: 41,
      },
    },
    setupFiles: ["./tests/setup.ts"],
  },
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
});
