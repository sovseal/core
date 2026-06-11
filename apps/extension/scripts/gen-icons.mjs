#!/usr/bin/env node
/**
 * gen-icons.mjs — dependency-free PNG icon generator for the sovseal extension.
 *
 * Renders a rounded-square mark in the marketing palette: a violet→purple
 * gradient (sovseal primary hsl(255 92% 76%) → purple-700 #7e22ce) with a
 * soft inner "seal" ring on a near-black core. Emits 16/32/48/128 px PNGs to
 * public/icons/. No canvas, no native deps — straight RGBA + zlib.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(OUT, { recursive: true });

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(body), 0);
  return Buffer.concat([len, body, crc]);
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function px(buf, w, x, y, r, g, b, a) {
  const i = (y * w + x) * 4;
  buf[i] = r;
  buf[i + 1] = g;
  buf[i + 2] = b;
  buf[i + 3] = a;
}

function render(size) {
  const raw = Buffer.alloc(size * size * 4, 0); // transparent
  const radius = size * 0.22;
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  // gradient endpoints
  const top = [0xc0, 0xa5, 0xfc]; // light violet
  const bot = [0x7e, 0x22, 0xce]; // purple-700
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // rounded-rect coverage (distance into nearest corner)
      const dx = Math.max(radius - x, x - (size - 1 - radius), 0);
      const dy = Math.max(radius - y, y - (size - 1 - radius), 0);
      const corner = Math.sqrt(dx * dx + dy * dy);
      let alpha = 255;
      if (corner > radius) continue; // outside rounded corner
      if (corner > radius - 1) alpha = Math.round(255 * (radius - corner));
      const t = y / (size - 1);
      let r = lerp(top[0], bot[0], t);
      let g = lerp(top[1], bot[1], t);
      let b = lerp(top[2], bot[2], t);
      // inner "seal" — near-black core disc with a thin violet ring
      const dist = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
      const coreR = size * 0.3;
      const ringR = size * 0.36;
      if (dist < coreR) {
        r = 0x12;
        g = 0x12;
        b = 0x12;
      } else if (dist < ringR) {
        r = 0xe9;
        g = 0xd5;
        b = 0xff;
      }
      px(raw, size, x, y, r, g, b, alpha);
    }
  }
  // add filter byte (0) per scanline
  const stride = size * 4;
  const filtered = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    filtered[y * (stride + 1)] = 0;
    raw.copy(filtered, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(filtered, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return png;
}

for (const size of [16, 32, 48, 128]) {
  const file = join(OUT, `icon-${size}.png`);
  writeFileSync(file, render(size));
  console.log("wrote", file);
}
