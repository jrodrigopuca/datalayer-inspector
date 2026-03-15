import { defineConfig } from "vite";
import { resolve } from "path";

/**
 * Separate Vite config for building the page script as a standalone IIFE bundle.
 * This ensures no external imports and works in page context.
 *
 * Run with: npx vite build --config vite.page-script.config.ts
 */
export default defineConfig({
  publicDir: false, // Disable public dir copying
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "./src/shared"),
    },
  },
  build: {
    // Output to public folder so CRXJS can find it
    outDir: "public",
    // Don't empty outDir
    emptyOutDir: false,
    // Library mode for IIFE output
    lib: {
      entry: resolve(__dirname, "src/page/index.ts"),
      name: "StrataPageScript",
      // Output as IIFE (Immediately Invoked Function Expression)
      formats: ["iife"],
      fileName: () => "page-script.js",
    },
    rollupOptions: {
      // No external dependencies - bundle everything inline
      external: [],
      output: {
        // Ensure no imports in output
        inlineDynamicImports: true,
        // Compact output
        compact: true,
      },
    },
    // Use esbuild for minification (default, no extra dep needed)
    minify: "esbuild",
    // No source maps for page script
    sourcemap: false,
  },
});
