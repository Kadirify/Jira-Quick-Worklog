// Eklenti ikonlarini sifir-bagimlilikla uretir (rounded-rect gradient + beyaz saat).
// Calistirma (extension/ dizininden): node tools/make-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const OUT = new URL("../icons/", import.meta.url);
mkdirSync(OUT, { recursive: true });

// ---- PNG kodlayici ----
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---- Cizim yardimcilari (normalize 0..1 koordinat) ----
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
function sdRoundRect(px, py, half, r) {
  const qx = Math.abs(px - 0.5) - (half - r);
  const qy = Math.abs(py - 0.5) - (half - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

const A = [99, 102, 241]; // indigo-500
const B = [139, 92, 246]; // violet-500

function render(size) {
  const SS = 4;
  const hi = size * SS;
  const buf = Buffer.alloc(hi * hi * 4);
  for (let y = 0; y < hi; y++) {
    for (let x = 0; x < hi; x++) {
      const px = (x + 0.5) / hi, py = (y + 0.5) / hi;
      let r = 0, g = 0, b = 0, a = 0;
      if (sdRoundRect(px, py, 0.5, 0.22) < 0) {
        const col = mix(A, B, (px + py) / 2);
        r = col[0]; g = col[1]; b = col[2]; a = 255;
      }
      const d = Math.hypot(px - 0.5, py - 0.5);
      const ring = Math.abs(d - 0.27) < 0.03 && d < 0.31;
      const hourHand = segDist(px, py, 0.5, 0.5, 0.5, 0.5 - 0.14) < 0.022;
      const minHand = segDist(px, py, 0.5, 0.5, 0.5 + 0.18, 0.5) < 0.022;
      const dot = d < 0.035;
      if (ring || hourHand || minHand || dot) { r = 255; g = 255; b = 255; a = 255; }
      const i = (y * hi + x) * 4;
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
    }
  }
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * hi + (x * SS + sx)) * 4;
          r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; a += buf[i + 3];
        }
      }
      const n = SS * SS, o = (y * size + x) * 4;
      out[o] = Math.round(r / n); out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n); out[o + 3] = Math.round(a / n);
    }
  }
  return out;
}

for (const size of [16, 48, 128]) {
  const png = encodePNG(size, size, render(size));
  writeFileSync(new URL(`./icon${size}.png`, OUT), png);
  console.log(`icon${size}.png yazildi (${png.length} byte)`);
}
