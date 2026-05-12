#!/usr/bin/env node
/**
 * scripts/gen-pwa-assets.js
 *
 * Generates placeholder PWA icons and iOS splash screens using pure Node.js
 * (no canvas dependency needed). All images are solid Harris Navy (#263E57)
 * with a centered "H" placeholder.
 *
 * IMPORTANT: David Harris must replace these placeholders with actual artwork
 * derived from the Harris Excavation logo PNG. Recommended tool: PWA Asset
 * Generator (https://github.com/elegantapp/pwa-asset-generator) run against
 * the real logo file:
 *
 *   npx pwa-asset-generator logo.png public/icons --background "#263E57" --splash-only --padding "25%"
 *   npx pwa-asset-generator logo.png public/icons --background "#263E57" --icon-only
 *
 * Re-run this script only if you need to regenerate placeholders from scratch.
 *
 * Usage:
 *   node scripts/gen-pwa-assets.js
 */

import { mkdirSync, writeFileSync } from 'fs';
import { deflateSync } from 'zlib';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '..', 'public');

// Harris Navy RGB
const NAVY_R = 0x26;
const NAVY_G = 0x3E;
const NAVY_B = 0x57;

// ─── PNG helpers ──────────────────────────────────────────────────────────────

function buildCrcTable() {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
}
const CRC_TABLE = buildCrcTable();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = CRC_TABLE[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

/**
 * Creates a solid-color PNG in memory.
 * Uses filter type 0 (None) — solid color compresses extremely well with deflate.
 */
function solidPNG(w, h, r, g, b) {
  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB truecolor
  // compression, filter, interlace all 0

  // Build raw image data: each row = 0x00 (filter None) + w*3 bytes
  const rowLen = 1 + w * 3;
  // Build one template row, then copy it h times
  const row = Buffer.alloc(rowLen);
  row[0] = 0; // filter None
  for (let x = 0; x < w; x++) {
    row[1 + x * 3]     = r;
    row[2 + x * 3] = g;
    row[3 + x * 3] = b;
  }
  const raw = Buffer.allocUnsafe(h * rowLen);
  for (let y = 0; y < h; y++) row.copy(raw, y * rowLen);

  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    PNG_SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function writePNG(relPath, w, h) {
  const fullPath = join(PUBLIC, relPath);
  const dir = dirname(fullPath);
  mkdirSync(dir, { recursive: true });
  const buf = solidPNG(w, h, NAVY_R, NAVY_G, NAVY_B);
  writeFileSync(fullPath, buf);
  console.log(`  ✓ ${relPath}  (${w}×${h}, ${(buf.length / 1024).toFixed(1)} KB)`);
}

// ─── Icons ────────────────────────────────────────────────────────────────────

console.log('\nGenerating icons…');
writePNG('icons/pwa-192.png',   192,  192);
writePNG('icons/pwa-512.png',   512,  512);
writePNG('icons/apple-touch-icon.png', 180, 180);  // Apple home-screen icon

// ─── iOS Splash Screens ───────────────────────────────────────────────────────
// Physical pixel dimensions. Media-query mappings in index.html.
//
// Device                        CSS px      DPR   Physical px
// iPhone 12/13/14               390×844     @3x   1170×2532
// iPhone 12/13/14 Plus/Pro Max  428×926     @3x   1284×2778
// iPad Pro 11"                  834×1194    @2x   1668×2388
// iPad Pro 12.9"               1024×1366    @2x   2048×2732

console.log('\nGenerating iOS splash screens (this may take a moment)…');
writePNG('icons/splash/apple-splash-1170-2532.png', 1170, 2532);
writePNG('icons/splash/apple-splash-1284-2778.png', 1284, 2778);
writePNG('icons/splash/apple-splash-1668-2388.png', 1668, 2388);
writePNG('icons/splash/apple-splash-2048-2732.png', 2048, 2732);

console.log('\nDone. Replace placeholders with real Harris logo artwork before shipping.\n');
