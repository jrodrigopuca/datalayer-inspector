#!/usr/bin/env node
/**
 * Normalize a capture into a Chrome Web Store image.
 *
 * Takes any PNG/JPEG (a retina window grab with its shadow, a cropped
 * region, whatever) and writes a 24-bit PNG, no alpha, at the exact size the
 * store expects, letterboxed on a solid background so nothing is distorted.
 *
 *   pnpm store:image <input> [output] [--size screenshot|small|marquee|WxH]
 *                            [--fit contain|cover] [--bg #0b0d12] [--trim]
 *
 * Sizes: screenshot 1280x800 (default), small 440x280, marquee 1400x560.
 * --trim removes uniform borders first (e.g. the transparent margin macOS
 * adds around a window capture).
 */

import { basename, dirname, extname, join } from "node:path";
import sharp from "sharp";

const SIZES = {
  screenshot: [1280, 800],
  small: [440, 280],
  marquee: [1400, 560],
};

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};

const input = positional[0];
if (!input) {
  console.error(
    "usage: store-image <input> [output] [--size ...] [--fit contain|cover] [--bg #rrggbb] [--trim]"
  );
  process.exit(1);
}

const sizeArg = opt("--size", "screenshot");
const [width, height] = SIZES[sizeArg] ?? sizeArg.split("x").map(Number);
if (!Number.isInteger(width) || !Number.isInteger(height)) {
  console.error(
    `bad --size "${sizeArg}"; use screenshot | small | marquee | WxH`
  );
  process.exit(1);
}
const fit = opt("--fit", "contain");
const bg = opt("--bg", "#0b0d12");
const trim = args.includes("--trim");
const output =
  positional[1] ??
  join(
    dirname(input),
    `${basename(input, extname(input))}-${width}x${height}.png`
  );

let image = sharp(input);
if (trim) image = image.trim();

// Flatten alpha onto the background BEFORE resizing so edges blend cleanly,
// then letterbox (contain) or fill (cover) to the exact store size.
await image
  .flatten({ background: bg })
  .resize(width, height, { fit, background: bg, position: "centre" })
  .removeAlpha()
  .png({ compressionLevel: 9 })
  .toFile(output);

const meta = await sharp(output).metadata();
console.log(
  `${output}  ${meta.width}x${meta.height}  channels=${meta.channels}  alpha=${meta.hasAlpha ? "yes" : "no"}`
);
