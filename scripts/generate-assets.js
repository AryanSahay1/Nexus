#!/usr/bin/env node
/**
 * Programmatic asset generator for Project Nexus.
 *
 * Produces:
 *   assets/icon.png              1024x1024  app icon
 *   assets/adaptive-icon.png     1024x1024  Android adaptive icon foreground
 *   assets/splash.png            1284x2778  iPhone-class splash
 *   assets/favicon.png             48x48    web favicon
 *
 * The art is the canonical Nexus splash: dark base canvas with a centered
 * cyan lightning bolt rendered as a closed polygon. We avoid raster fonts —
 * Marcus's spec keeps the splash typography in app code, so the generated
 * PNG is logo-only.
 */

/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const ASSETS = path.join(__dirname, '..', 'assets');
fs.mkdirSync(ASSETS, { recursive: true });

const BG = { r: 0x0a, g: 0x0a, b: 0x0f, a: 0xff };
const BOLT = { r: 0x00, g: 0xf5, b: 0xd4, a: 0xff };
const BOLT_GLOW = { r: 0x00, g: 0xf5, b: 0xd4, a: 0x33 };

/** Lightning-bolt vertices as fractions of the bounding box. */
const BOLT_PATH = [
  [0.55, 0.05],
  [0.18, 0.55],
  [0.42, 0.55],
  [0.30, 0.95],
  [0.78, 0.42],
  [0.52, 0.42],
  [0.65, 0.05],
];

const fill = (png, color) => {
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const idx = (png.width * y + x) << 2;
      png.data[idx] = color.r;
      png.data[idx + 1] = color.g;
      png.data[idx + 2] = color.b;
      png.data[idx + 3] = color.a;
    }
  }
};

const setPixel = (png, x, y, c) => {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  // alpha-composite c over existing pixel
  const a = c.a / 255;
  const inv = 1 - a;
  png.data[idx] = Math.round(c.r * a + png.data[idx] * inv);
  png.data[idx + 1] = Math.round(c.g * a + png.data[idx + 1] * inv);
  png.data[idx + 2] = Math.round(c.b * a + png.data[idx + 2] * inv);
  png.data[idx + 3] = 0xff;
};

const insidePolygon = (px, py, vertices) => {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i, i += 1) {
    const xi = vertices[i][0];
    const yi = vertices[i][1];
    const xj = vertices[j][0];
    const yj = vertices[j][1];
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

const drawBolt = (png, opts) => {
  const { sx, sy, sw, sh, color } = opts;
  for (let y = 0; y < sh; y += 1) {
    for (let x = 0; x < sw; x += 1) {
      const ux = x / sw;
      const uy = y / sh;
      if (insidePolygon(ux, uy, BOLT_PATH)) {
        setPixel(png, sx + x, sy + y, color);
      }
    }
  }
};

const drawCircleGlow = (png, cx, cy, radius, color) => {
  const r2 = radius * radius;
  for (let y = -radius; y <= radius; y += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      const d2 = x * x + y * y;
      if (d2 > r2) continue;
      const t = 1 - d2 / r2;
      const a = Math.round(color.a * t * t);
      if (a <= 1) continue;
      setPixel(png, cx + x, cy + y, { ...color, a });
    }
  }
};

const writePng = (file, png) => {
  const buf = PNG.sync.write(png);
  fs.writeFileSync(file, buf);
  console.log(`wrote ${file} (${png.width}x${png.height}, ${buf.length} bytes)`);
};

const buildIcon = (size, target) => {
  const png = new PNG({ width: size, height: size });
  fill(png, BG);
  // soft cyan halo
  drawCircleGlow(png, size / 2, size / 2, size * 0.45, BOLT_GLOW);
  // bolt occupies central 60% of the canvas, vertically centered
  const sw = Math.round(size * 0.45);
  const sh = Math.round(size * 0.7);
  const sx = Math.round((size - sw) / 2);
  const sy = Math.round((size - sh) / 2);
  drawBolt(png, { sx, sy, sw, sh, color: BOLT });
  writePng(target, png);
};

const buildSplash = (target) => {
  const w = 1284;
  const h = 2778;
  const png = new PNG({ width: w, height: h });
  fill(png, BG);
  // central glow + bolt, vertically centered
  const cx = w / 2;
  const cy = h / 2;
  drawCircleGlow(png, cx, cy, 600, BOLT_GLOW);
  const sw = 480;
  const sh = 720;
  drawBolt(png, {
    sx: Math.round(cx - sw / 2),
    sy: Math.round(cy - sh / 2),
    sw,
    sh,
    color: BOLT,
  });
  writePng(target, png);
};

const buildFavicon = (target) => {
  const png = new PNG({ width: 48, height: 48 });
  fill(png, BG);
  drawBolt(png, { sx: 8, sy: 4, sw: 32, sh: 40, color: BOLT });
  writePng(target, png);
};

buildIcon(1024, path.join(ASSETS, 'icon.png'));
buildIcon(1024, path.join(ASSETS, 'adaptive-icon.png'));
buildSplash(path.join(ASSETS, 'splash.png'));
buildFavicon(path.join(ASSETS, 'favicon.png'));
