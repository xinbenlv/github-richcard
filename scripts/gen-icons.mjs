/**
 * Generates simple PNG icons for the extension.
 * Uses only built-in Node.js APIs — no external deps needed.
 * Run: node scripts/gen-icons.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

mkdirSync(publicDir, { recursive: true });

// Minimal 1x1 sky-blue PNG as a base (we embed a proper one via canvas if available)
function makePng(size) {
  // We'll write a data-URL style SVG → encode as a minimal PNG stub
  // Real icons would use canvas or sharp. This creates a blue square placeholder.
  // PNG header + IHDR + IDAT + IEND (hand-crafted minimal)
  // For a real build, use: `pnpm add -D sharp` and generate proper PNGs.
  // This minimal version will make the extension load without errors.
  const { createCanvas } = globalThis;
  if (createCanvas) {
    const c = createCanvas(size, size);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0ea5e9';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.floor(size * 0.45)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('G', size / 2, size / 2);
    return c.toBuffer('image/png');
  }
  return null;
}

// Fallback: write minimal valid PNGs (1px sky-blue scaled by the browser)
// These are pre-encoded 16x16 sky-blue (#0ea5e9) PNGs as base64
const BLUE_16_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAH0lEQVQ4T2NkoBAwUqifYdSAUQNGDRg1YNSAoW0AABqcAAHtjBWpAAAAAElFTkSuQmCC';

function b64ToBuf(b64) {
  const bin = atob(b64);
  const buf = Buffer.alloc(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

for (const size of [16, 32, 48, 128]) {
  const buf = makePng(size) ?? b64ToBuf(BLUE_16_B64);
  writeFileSync(join(publicDir, `icon-${size}.png`), buf);
  console.log(`✓ icon-${size}.png`);
}
console.log('Icons written to public/');
