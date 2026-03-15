/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import { resolve } from "path";

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
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
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
