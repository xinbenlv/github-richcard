#!/usr/bin/env node
/**
 * gen-icons.mjs — generate real PNG icons at all required sizes from a single SVG source.
 * Also generates CWS promo tiles (440x280 small, 1400x560 marquee) under docs/cws-assets/.
 *
 * Output:
 *   public/icon-{16,32,48,128}.png
 *   docs/cws-assets/promo-440x280-small.png
 *   docs/cws-assets/promo-1400x560-marquee.png
 *
 * Run: pnpm icons
 */

import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
mkdirSync(publicDir, { recursive: true });

// Branding: GitHub-purple → blue gradient, white "G" mark, green follow checkmark badge.
const iconSvg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"  stop-color="#6e40c9"/>
      <stop offset="100%" stop-color="#0969da"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="24" fill="url(#bg)"/>
  <text x="64" y="64"
        text-anchor="middle"
        dominant-baseline="central"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-weight="800"
        font-size="84"
        fill="#ffffff">G</text>
  <circle cx="96" cy="32" r="14" fill="#2da44e" stroke="#ffffff" stroke-width="3"/>
  <path d="M89 32 l5 5 l9 -10"
        stroke="#ffffff" stroke-width="3" fill="none"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

for (const size of [16, 32, 48, 128]) {
  const buf = await sharp(Buffer.from(iconSvg(size)))
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
  const path = join(publicDir, `icon-${size}.png`);
  writeFileSync(path, buf);
  console.log(`  ✔ ${path} (${size}×${size}, ${buf.length} bytes)`);
}

// CWS promo tiles
const cwsAssetsDir = join(__dirname, '..', 'docs', 'cws-assets');
mkdirSync(cwsAssetsDir, { recursive: true });

async function tile(width, height, label) {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"  stop-color="#6e40c9"/>
      <stop offset="100%" stop-color="#0969da"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <text x="${width / 2}" y="${height / 2 - 16}"
        text-anchor="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-weight="800"
        font-size="${Math.floor(height * 0.18)}"
        fill="#ffffff">GitHub RichCard</text>
  <text x="${width / 2}" y="${height / 2 + Math.floor(height * 0.12)}"
        text-anchor="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-size="${Math.floor(height * 0.07)}"
        fill="#dbe6f5">Extended info for GitHub repos</text>
</svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  const path = join(cwsAssetsDir, `promo-${width}x${height}-${label}.png`);
  writeFileSync(path, buf);
  console.log(`  ✔ ${path}`);
}

// CWS sizes
await tile(440, 280, 'cws-small');
await tile(1400, 560, 'cws-marquee');
// Edge Add-ons sizes
await tile(300, 200, 'edge-small');
await tile(844, 312, 'edge-large');
console.log('\nDone.');
