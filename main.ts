// makefun-news-image-20261118
// Draws a one-page newspaper front page summing up Wednesday 18 November 2026
// and writes it to $MAKEFUN_OUTPUT_DIR/entry.png (1024x1024 PNG).
// Everything is drawn procedurally: own PNG encoder (zlib + CRC32), own 5x7
// bitmap font, flat vector art. No assets, no network, fully deterministic.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
const PAPER = [246, 241, 227];
const INK = [27, 42, 74];
const INK_SOFT = [64, 76, 104];
const AMBER = [192, 138, 18];
const RED = [179, 55, 46];
const RED_DARK = [122, 32, 28];
const TEAL = [46, 107, 102];
const SKY = [127, 168, 201];
const SKY_LIGHT = [198, 220, 235];
const SEA = [46, 94, 122];
const SEA_DARK = [30, 66, 90];
const SAND = [232, 217, 168];
const WHITE = [255, 255, 255];
const BLACK = [20, 20, 20];
const GREY = [148, 148, 140];
const GREEN = [46, 160, 90];
const GREEN_DARK = [24, 110, 58];

type RGB = [number, number, number];

// ------------------------------------------------------- CRC32 (PNG chunks)
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(rgb: Uint8Array, w: number, h: number): Buffer {
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: none
    raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (1 + w * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------- 5x7 bitmap font
// Each glyph: 7 rows of 5 bits, "1" = ink. Uppercase, digits, punctuation.
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
};

// ------------------------------------------------------------ canvas + text
class Canvas {
  buf: Uint8Array;
  w: number;
  h: number;
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.buf = new Uint8Array(w * h * 3);
  }
  set(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.buf[i] = c[0];
    this.buf[i + 1] = c[1];
    this.buf[i + 2] = c[2];
  }
  fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.ceil(x + w));
    const y1 = Math.min(this.h, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy++) {
      let i = (yy * this.w + x0) * 3;
      for (let xx = x0; xx < x1; xx++) {
        this.buf[i] = c[0];
        this.buf[i + 1] = c[1];
        this.buf[i + 2] = c[2];
        i += 3;
      }
    }
  }
  hline(x0: number, x1: number, y: number, c: RGB, t = 1): void {
    this.fillRect(Math.min(x0, x1), y, Math.abs(x1 - x0) + 1, t, c);
  }
  vline(x: number, y0: number, y1: number, c: RGB, t = 1): void {
    this.fillRect(x, Math.min(y0, y1), t, Math.abs(y1 - y0) + 1, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 1): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
    const half = Math.floor(t / 2);
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(x0 + (dx * i) / steps);
      const y = Math.round(y0 + (dy * i) / steps);
      this.fillRect(x - half, y - half, t, t, c);
    }
  }
  circle(cx: number, cy: number, r: number, c: RGB): void {
    for (let y = -r; y <= r; y++) {
      const half = Math.floor(Math.sqrt(r * r - y * y));
      this.fillRect(cx - half, cy + y, half * 2 + 1, 1, c);
    }
  }
  ring(cx: number, cy: number, r: number, c: RGB, t = 2): void {
    for (let a = 0; a < 360; a += 1) {
      const rad = (a * Math.PI) / 180;
      for (let k = 0; k < t; k++) {
        this.set(
          Math.round(cx + (r - k) * Math.cos(rad)),
          Math.round(cy + (r - k) * Math.sin(rad)),
          c,
        );
      }
    }
  }
  triangle(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    c: RGB,
  ): void {
    const minY = Math.max(0, Math.min(y0, y1, y2));
    const maxY = Math.min(this.h - 1, Math.max(y0, y1, y2));
    for (let y = minY; y <= maxY; y++) {
      const xs: number[] = [];
      const edges: [number, number, number, number][] = [
        [x0, y0, x1, y1],
        [x1, y1, x2, y2],
        [x2, y2, x0, y0],
      ];
      for (const [ax, ay, bx, by] of edges) {
        if ((ay <= y && by > y) || (by <= y && ay > y)) {
          xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
        }
      }
      if (xs.length >= 2) {
        const lo = Math.max(0, Math.floor(Math.min(...xs)));
        const hi = Math.min(this.w - 1, Math.ceil(Math.max(...xs)));
        this.fillRect(lo, y, hi - lo + 1, 1, c);
      }
    }
  }
  // Burst / explosion star: alternating long and short spikes.
  burst(cx: number, cy: number, rOuter: number, rInner: number, c: RGB, spikes = 8): void {
    const pts: [number, number][] = [];
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? rOuter : rInner;
      const a = (i * Math.PI) / spikes - Math.PI / 2;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      this.triangle(cx, cy, x1, y1, x2, y2, c);
    }
  }
}

function textWidth(text: string, scale: number): number {
  return text.length * 6 * scale - scale;
}
function drawText(
  cv: Canvas,
  text: string,
  x: number,
  y: number,
  scale: number,
  c: RGB,
): void {
  const upper = text.toUpperCase();
  let cx = x;
  for (const ch of upper) {
    const glyph = FONT[ch] ?? FONT["?"];
    for (let row = 0; row < 7; row++) {
      const bits = glyph[row];
      for (let col = 0; col < 5; col++) {
        if (bits[col] === "1") {
          cv.fillRect(cx + col * scale, y + row * scale, scale, scale, c);
        }
      }
    }
    cx += 6 * scale;
  }
}
function drawTextCentered(
  cv: Canvas,
  text: string,
  cx: number,
  y: number,
  scale: number,
  c: RGB,
): void {
  drawText(cv, text, cx - Math.floor(textWidth(text, scale) / 2), y, scale, c);
}
// Wrap words to a max pixel width; returns lines (already upper-cased by drawText).
function wrapText(text: string, scale: number, maxW: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const test = cur === "" ? word : cur + " " + word;
    if (textWidth(test, scale) <= maxW || cur === "") {
      cur = test;
    } else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}
function drawBlock(
  cv: Canvas,
  text: string,
  x: number,
  y: number,
  scale: number,
  maxW: number,
  c: RGB,
  lineGap = 1,
): number {
  const lines = wrapText(text, scale, maxW);
  const lh = 7 * scale + lineGap * scale;
  lines.forEach((ln, i) => drawText(cv, ln, x, y + i * lh, scale, c));
  return y + lines.length * lh;
}
function drawBlockCentered(
  cv: Canvas,
  text: string,
  cx: number,
  y: number,
  scale: number,
  maxW: number,
  c: RGB,
  lineGap = 1,
): number {
  const lines = wrapText(text, scale, maxW);
  const lh = 7 * scale + lineGap * scale;
  lines.forEach((ln, i) =>
    drawTextCentered(cv, ln, cx, y + i * lh, scale, c),
  );
  return y + lines.length * lh;
}

// ------------------------------------------------------------ masthead
function drawMasthead(cv: Canvas): void {
  cv.fillRect(0, 0, W, 120, PAPER);
  // top double rule
  cv.fillRect(16, 14, W - 32, 4, INK);
  cv.fillRect(16, 22, W - 32, 2, INK);
  drawTextCentered(cv, "THE WORLD IN ONE DAY - WEDNESDAY", W / 2, 34, 2, INK_SOFT);
  // the date, huge
  drawTextCentered(cv, "18 NOVEMBER 2026", W / 2, 52, 8, INK);
  // bottom double rule
  cv.fillRect(16, 116, W - 32, 2, INK);
  cv.fillRect(16, 120, W - 32, 4, INK);
}

// ------------------------------------------------------------ hero: Gulf
function drawGulf(cv: Canvas, x: number, y: number, w: number, h: number): void {
  // sky bands
  cv.fillRect(x, y, w, h, SKY_LIGHT);
  cv.fillRect(x, y, w, 150, SKY);
  cv.fillRect(x, y + 150, w, 60, SAND);
  // sun
  cv.circle(x + 88, y + 74, 34, AMBER);
  cv.ring(x + 88, y + 74, 44, AMBER, 3);
  // distant island (Qeshm) silhouette
  cv.fillRect(x + 330, y + 196, 190, 16, SEA_DARK);
  cv.triangle(x + 350, y + 196, x + 380, y + 168, x + 410, y + 196, SEA_DARK);
  cv.fillRect(x + 396, y + 176, 10, 20, SEA_DARK); // launch tower
  // smoke from the island strike
  cv.circle(x + 420, y + 158, 16, GREY);
  cv.circle(x + 436, y + 146, 20, GREY);
  cv.circle(x + 456, y + 132, 24, GREY);
  // sea
  cv.fillRect(x, y + 212, w, h - 212 - 118, SEA);
  cv.fillRect(x, y + 212, w, 4, SEA_DARK);
  for (let i = 0; i < 5; i++) {
    const wy = y + 236 + i * 14;
    cv.hline(x + 20 + (i % 2) * 40, x + w - 30 - (i % 3) * 30, wy, SKY_LIGHT, 2);
  }
  // a warship on the sea
  cv.fillRect(x + 60, y + 252, 150, 14, INK);
  cv.triangle(x + 60, y + 252, x + 60, y + 224, x + 88, y + 252, INK);
  cv.fillRect(x + 120, y + 232, 8, 20, INK);
  cv.fillRect(x + 210, y + 252, 26, 10, INK);
  // explosion bursts over the water
  cv.burst(x + 470, y + 250, 30, 12, AMBER, 8);
  cv.burst(x + 470, y + 250, 16, 7, RED, 8);
  cv.burst(x + 300, y + 286, 22, 9, AMBER, 8);
  cv.burst(x + 300, y + 286, 11, 5, RED, 8);
  // fighter jets with contrails
  const jet = (jx: number, jy: number) => {
    cv.triangle(jx, jy, jx + 44, jy + 7, jx, jy + 14, INK);
    cv.triangle(jx + 12, jy + 7, jx + 30, jy - 8, jx + 30, jy + 7, INK);
    cv.line(jx - 70, jy + 7, jx - 4, jy + 7, WHITE, 3);
  };
  jet(x + 120, y + 96);
  jet(x + 330, y + 60);
  // drone dots
  cv.circle(x + 250, y + 130, 4, INK);
  cv.circle(x + 270, y + 142, 4, INK);
  cv.circle(x + 520, y + 110, 4, INK);
  // headline band
  const bandY = y + h - 118;
  cv.fillRect(x, bandY, w, 118, INK);
  cv.fillRect(x, bandY, w, 4, AMBER);
  drawText(cv, "WAR SPILLS", x + 18, bandY + 14, 4, WHITE);
  drawText(cv, "ACROSS THE GULF", x + 18, bandY + 48, 4, WHITE);
  drawBlock(
    cv,
    "US HITS QESHM ISLAND - IRAN STRIKES BACK AT BAHRAIN AND KUWAIT",
    x + 18,
    bandY + 84,
    2,
    w - 36,
    AMBER,
  );
}

// ------------------------------------------------------------ Nvidia panel
function drawNvidia(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.fillRect(x, y, w, h, INK);
  cv.fillRect(x, y, w, 5, GREEN);
  // chip
  const cx = x + 24;
  const cy = y + 16;
  cv.fillRect(cx, cy, 74, 74, GREEN_DARK);
  cv.fillRect(cx + 8, cy + 8, 58, 58, GREEN);
  cv.fillRect(cx + 22, cy + 22, 30, 30, INK);
  drawText(cv, "AI", cx + 26, cy + 30, 2, GREEN);
  for (let i = 0; i < 4; i++) {
    cv.fillRect(cx + 12 + i * 16, cy - 8, 6, 8, GREEN);
    cv.fillRect(cx + 12 + i * 16, cy + 74, 6, 8, GREEN);
    cv.fillRect(cx - 8, cy + 12 + i * 16, 8, 6, GREEN);
    cv.fillRect(cx + 74, cy + 12 + i * 16, 8, 6, GREEN);
  }
  // rising bar chart
  const bars = [18, 28, 40, 56, 74];
  const bx = x + 128;
  const base = y + 96;
  bars.forEach((bh, i) => {
    const col = i === bars.length - 1 ? AMBER : GREEN;
    cv.fillRect(bx + i * 48, base - bh, 34, bh, col);
  });
  cv.hline(bx, bx + 5 * 48 - 14, base, WHITE, 2);
  // headline
  drawText(cv, "NVIDIA: RECORD", x + 128, y + 118, 3, WHITE);
  drawText(cv, "$115.8B QUARTER", x + 128, y + 142, 3, WHITE);
  drawBlock(
    cv,
    "DATA CENTER $107.6B, UP 110% - SEC PROBE - HUANG NOT BACK",
    x + 24,
    y + 168,
    2,
    w - 48,
    SKY_LIGHT,
  );
}

// ------------------------------------------------------------ Kerch panel
function drawKerch(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.fillRect(x, y, w, h, SKY_LIGHT);
  cv.fillRect(x, y, w, 96, SKY);
  // sun haze
  cv.circle(x + w - 70, y + 44, 22, SAND);
  // strait
  cv.fillRect(x, y + 96, w, h - 96 - 84, SEA);
  for (let i = 0; i < 3; i++) {
    cv.hline(x + 18 + i * 30, x + w - 24 - i * 20, y + 112 + i * 12, WHITE, 2);
  }
  // bridge deck, left half intact
  const deckY = y + 74;
  cv.fillRect(x, deckY, 150, 8, INK);
  cv.fillRect(x + 150, deckY, 8, 34, INK); // standing pier
  // standing arch (left)
  cv.fillRect(x + 30, deckY - 26, 8, 26, INK);
  cv.fillRect(x + 30, deckY - 30, 90, 6, INK);
  cv.fillRect(x + 112, deckY - 26, 8, 26, INK);
  // broken right half: deck tilted down into the water
  cv.line(x + 158, deckY + 4, x + 260, deckY + 52, INK, 8);
  cv.line(x + 200, deckY + 4, x + 300, deckY + 40, RED, 5);
  // fallen span in the water + splash
  cv.fillRect(x + 250, y + 128, 90, 10, INK);
  cv.circle(x + 262, y + 122, 8, WHITE);
  cv.circle(x + 286, y + 118, 10, WHITE);
  cv.circle(x + 320, y + 124, 7, WHITE);
  // smoke
  cv.circle(x + 240, y + 58, 12, GREY);
  cv.circle(x + 256, y + 46, 15, GREY);
  // headline band
  const bandY = y + h - 84;
  cv.fillRect(x, bandY, w, 84, PAPER);
  cv.fillRect(x, bandY, w, 4, RED);
  drawText(cv, "KERCH BRIDGE DOWN", x + 16, bandY + 14, 3, INK);
  drawBlock(
    cv,
    "ROAD SPAN FALLS - RAIL LINE DAMAGED",
    x + 16,
    bandY + 44,
    2,
    w - 32,
    RED_DARK,
  );
}

// ------------------------------------------------------------ bottom panels
function drawVirus(cv: Canvas, cx: number, cy: number, r: number, c: RGB): void {
  cv.circle(cx, cy, r, c);
  for (let a = 0; a < 360; a += 30) {
    const rad = (a * Math.PI) / 180;
    const x1 = Math.round(cx + r * Math.cos(rad));
    const y1 = Math.round(cy + r * Math.sin(rad));
    const x2 = Math.round(cx + (r + 12) * Math.cos(rad));
    const y2 = Math.round(cy + (r + 12) * Math.sin(rad));
    cv.line(x1, y1, x2, y2, c, 3);
    cv.circle(x2, y2, 4, c);
  }
  cv.circle(cx - Math.floor(r / 3), cy - Math.floor(r / 3), Math.floor(r / 4), WHITE);
}

function drawMeasles(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.fillRect(x, y, w, h, PAPER);
  cv.fillRect(x, y, w, 5, RED);
  drawVirus(cv, x + w / 2, y + 92, 46, RED);
  drawVirus(cv, x + 56, y + 60, 20, RED_DARK);
  drawVirus(cv, x + w - 56, y + 66, 16, RED_DARK);
  drawTextCentered(cv, "MEASLES IS BACK", x + w / 2, y + 182, 3, INK);
  drawBlockCentered(
    cv,
    "US LOSES ELIMINATION STATUS AFTER 26 YEARS - 5,400 CASES, 10 DEAD",
    x + w / 2,
    y + 222,
    2,
    w - 32,
    RED_DARK,
  );
  drawBlockCentered(
    cv,
    "HIGHEST US TOTAL SINCE 1991",
    x + w / 2,
    y + 300,
    2,
    w - 32,
    INK_SOFT,
  );
}

function drawEbola(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.fillRect(x, y, w, h, RED_DARK);
  cv.fillRect(x, y, w, 5, AMBER);
  drawVirus(cv, x + w / 2, y + 92, 46, RED);
  drawVirus(cv, x + 56, y + 60, 20, AMBER);
  drawVirus(cv, x + w - 56, y + 66, 16, AMBER);
  drawTextCentered(cv, "EBOLA DOUBLES", x + w / 2, y + 182, 3, WHITE);
  drawBlockCentered(
    cv,
    "11,000+ CASES IN CONGO - 5,400 DEAD - CHILDREN HIT HARDEST",
    x + w / 2,
    y + 222,
    2,
    w - 32,
    SAND,
  );
  drawBlockCentered(
    cv,
    "2ND-LARGEST EBOLA OUTBREAK ON RECORD",
    x + w / 2,
    y + 300,
    2,
    w - 32,
    AMBER,
  );
}

function drawQuake(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.fillRect(x, y, w, h, SAND);
  cv.fillRect(x, y, w, 5, INK);
  // sky + shaking buildings
  cv.fillRect(x, y + 5, w, 110, SKY_LIGHT);
  const groundY = y + 150;
  cv.fillRect(x, groundY, w, 4, INK);
  // tilted buildings
  cv.fillRect(x + 40, groundY - 58, 44, 58, INK_SOFT);
  cv.line(x + 84, groundY - 58, x + 108, groundY - 34, INK, 6);
  cv.fillRect(x + 108, groundY - 34, 40, 34, INK_SOFT);
  cv.fillRect(x + 200, groundY - 80, 52, 80, INK);
  cv.line(x + 252, groundY - 80, x + 276, groundY - 52, INK, 6);
  cv.fillRect(x + 276, groundY - 52, 36, 52, INK_SOFT);
  // crack in the ground
  cv.line(x + 30, groundY + 4, x + 90, groundY + 26, INK, 4);
  cv.line(x + 90, groundY + 26, x + 150, groundY + 10, INK, 4);
  cv.line(x + 150, groundY + 10, x + 210, groundY + 30, INK, 4);
  cv.line(x + 210, groundY + 30, x + 280, groundY + 14, INK, 4);
  // seismograph zigzag
  const sy = groundY + 46;
  cv.hline(x + 20, x + w - 20, sy, INK, 2);
  let px = x + 20;
  let py = sy;
  const spikes = [0, -26, 14, -34, 20, -12, 30, -22, 8, 0];
  for (const s of spikes) {
    const nx = px + 26;
    const ny = sy + s;
    cv.line(px, py, nx, ny, RED, 3);
    px = nx;
    py = ny;
  }
  drawTextCentered(cv, "QUAKE M6.0", x + w / 2, y + 228, 4, INK);
  drawBlockCentered(
    cv,
    "PAPUA NEW GUINEA SHAKEN - 10 KM DEEP",
    x + w / 2,
    y + 266,
    2,
    w - 32,
    INK_SOFT,
  );
}

// ------------------------------------------------------------ footer + main
function drawFooter(cv: Canvas): void {
  const y = 968;
  cv.fillRect(16, y, W - 32, 44, INK);
  drawText(
    cv,
    "ALSO TODAY: PELTOLA FLIPS ALASKA - DEMOCRATS TAKE 56 SENATE SEATS",
    28,
    y + 6,
    2,
    WHITE,
  );
  drawText(
    cv,
    "AN-12 CRASH IN SIBERIA KILLS 19 - GTA VI UNLOCKS AT MIDNIGHT",
    28,
    y + 24,
    2,
    AMBER,
  );
}

function main(): void {
  const cv = new Canvas(W, H);
  cv.fillRect(0, 0, W, H, PAPER);
  drawMasthead(cv);
  drawGulf(cv, 16, 132, 580, 424);
  drawNvidia(cv, 612, 132, 396, 206);
  drawKerch(cv, 612, 350, 396, 206);
  drawMeasles(cv, 16, 572, 322, 384);
  drawEbola(cv, 350, 572, 322, 384);
  drawQuake(cv, 684, 572, 324, 384);
  drawFooter(cv);
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output/entry.png";
  const dir = outDir.endsWith(".png") ? outDir.slice(0, outDir.lastIndexOf("/")) : outDir;
  const file = outDir.endsWith(".png") ? outDir : join(outDir, "entry.png");
  mkdirSync(dir === "" ? "." : dir, { recursive: true });
  writeFileSync(file, encodePNG(cv.buf, W, H));
}

main();
