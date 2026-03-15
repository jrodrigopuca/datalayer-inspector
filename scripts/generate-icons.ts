/**
 * Script to generate PNG icons from SVG sources
 * Run with: npx tsx scripts/generate-icons.ts
 */

import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = join(__dirname, "../src/assets/icons");

const sizes = [16, 32, 48, 128];

async function generateIcons() {
  console.log("Generating PNG icons from SVG sources...\n");

  for (const size of sizes) {
    const svgPath = join(ICONS_DIR, `icon-${size}.svg`);
    const pngPath = join(ICONS_DIR, `icon-${size}.png`);

    try {
      const svgBuffer = readFileSync(svgPath);

      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(pngPath);

      console.log(`✓ Generated icon-${size}.png`);
    } catch (error) {
      console.error(`✗ Failed to generate icon-${size}.png:`, error);
    }
  }

  console.log("\nDone!");
}

generateIcons();
