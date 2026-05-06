/**
 * K-means palette quantization + palette swap engine.
 * Palettes: PICO-8, GBA, NES, custom.
 * Swaps: Player 2, Ice, Fire, Shadow Clone.
 */
import sharp from 'sharp';
import path from 'path';
import { mkdirSync } from 'fs';

// ---- Preset palettes ----
export const PALETTES = {
  'pico-8': [
    '#000000','#1d2b53','#7e2553','#008751',
    '#ab5236','#5f574f','#c2c3c7','#fff1e8',
    '#ff004d','#ffa300','#ffec27','#00e436',
    '#29adff','#83769c','#ff77a8','#ffccaa',
  ],
  'nes': [
    '#7c7c7c','#0000fc','#0000bc','#4428bc',
    '#940084','#a80020','#a81000','#881400',
    '#503000','#007800','#006800','#005800',
    '#004058','#000000','#000000','#000000',
    '#bcbcbc','#0078f8','#0058f8','#6844fc',
    '#d800cc','#e40058','#f83800','#e45c10',
    '#ac7c00','#00b800','#00a800','#00a844',
    '#008888','#000000','#000000','#000000',
    '#f8f8f8','#3cbcfc','#6888fc','#9878f8',
    '#f878f8','#f85898','#f87858','#fca044',
    '#f8b800','#b8f818','#58d854','#58f898',
    '#00e8d8','#787878','#000000','#000000',
    '#fcfcfc','#a4e4fc','#b8b8f8','#d8b8f8',
    '#f8b8f8','#f8a4c0','#f0d0b0','#fce0a8',
    '#f8d878','#d8f878','#b8f8b8','#b8f8d8',
    '#00fcfc','#f8d8f8','#000000','#000000',
  ],
  'gba': [
    '#000000','#191a1e','#333443','#4d4f68',
    '#666a8d','#8085b2','#99a0c7','#b3bcdb',
    '#ffffff','#ff0000','#00ff00','#0000ff',
    '#ffff00','#ff00ff','#00ffff','#ff8800',
  ],
  'custom': null,
};

// ---- Preset swap maps ----
export const SWAP_PRESETS = {
  'player-2': (colors) => colors.map(c => shiftHue(c, 120)),
  'ice': (colors) => colors.map(c => tintColor(c, 0x88, 0xcc, 0xff, 0.4)),
  'fire': (colors) => colors.map(c => tintColor(c, 0xff, 0x66, 0x00, 0.35)),
  'shadow-clone': (colors) => colors.map(c => tintColor(c, 0x44, 0x00, 0x88, 0.5)),
};

// ---- Color utilities ----
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}

function rgbToHex(r, g, b) {
  return '#' + [r,g,b].map(v => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
}

function shiftHue(hex, degrees) {
  const [r,g,b] = hexToRgb(hex);
  // HSL rotation
  const max = Math.max(r,g,b)/255, min = Math.min(r,g,b)/255;
  const l = (max + min) / 2;
  if (max === min) return hex;
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  const rm = r/255, gm = g/255, bm = b/255;
  if (max/255 === rm) h = ((gm - bm) / d + (gm < bm ? 6 : 0)) / 6;
  else if (max/255 === gm) h = ((bm - rm) / d + 2) / 6;
  else h = ((rm - gm) / d + 4) / 6;
  h = (h + degrees / 360) % 1;
  if (h < 0) h += 1;
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q2 = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p2 = 2 * l - q2;
  return rgbToHex(hue2rgb(p2,q2,h+1/3)*255, hue2rgb(p2,q2,h)*255, hue2rgb(p2,q2,h-1/3)*255);
}

function tintColor(hex, tr, tg, tb, factor) {
  const [r,g,b] = hexToRgb(hex);
  return rgbToHex(r*(1-factor)+tr*factor, g*(1-factor)+tg*factor, b*(1-factor)+tb*factor);
}

// ---- K-means palette quantization ----
function kmeansQuantize(pixels, k, iterations = 20) {
  // pixels: Array of [r,g,b]
  let centers = [];
  for (let i = 0; i < k; i++) {
    centers.push(pixels[Math.floor(Math.random() * pixels.length)].slice());
  }

  let assignments = new Int32Array(pixels.length);
  for (let iter = 0; iter < iterations; iter++) {
    let changed = false;
    for (let pi = 0; pi < pixels.length; pi++) {
      let best = 0, bestDist = Infinity;
      for (let ci = 0; ci < k; ci++) {
        const dr = pixels[pi][0]-centers[ci][0];
        const dg = pixels[pi][1]-centers[ci][1];
        const db = pixels[pi][2]-centers[ci][2];
        const d = dr*dr+dg*dg+db*db;
        if (d < bestDist) { bestDist = d; best = ci; }
      }
      if (assignments[pi] !== best) { assignments[pi] = best; changed = true; }
    }
    if (!changed) break;
    const sums = Array.from({length:k}, () => [0,0,0,0]);
    for (let pi = 0; pi < pixels.length; pi++) {
      const c = assignments[pi];
      sums[c][0] += pixels[pi][0]; sums[c][1] += pixels[pi][1];
      sums[c][2] += pixels[pi][2]; sums[c][3]++;
    }
    centers = sums.map(([r,g,b,n]) => n ? [r/n,g/n,b/n] : [0,0,0]);
  }
  return centers.map(c => rgbToHex(c[0],c[1],c[2]));
}

function nearestColor(r, g, b, palette) {
  let best = 0, bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const [pr,pg,pb] = hexToRgb(palette[i]);
    const d = (r-pr)**2+(g-pg)**2+(b-pb)**2;
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

export async function quantizeImage(imagePath, paletteName, customColors, outputPath) {
  mkdirSync(path.dirname(outputPath), { recursive: true });

  const { data, info } = await sharp(imagePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  let palette;

  if (paletteName === 'custom' && customColors) {
    palette = customColors;
  } else if (PALETTES[paletteName]) {
    palette = PALETTES[paletteName];
  } else {
    // K-means to k=16 from image
    const pixels = [];
    for (let i = 0; i < data.length; i += 4) {
      if (data[i+3] > 128) pixels.push([data[i], data[i+1], data[i+2]]);
    }
    palette = kmeansQuantize(pixels.slice(0, 10000), 16);
  }

  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i+3];
    if (a < 10) { out[i]=0;out[i+1]=0;out[i+2]=0;out[i+3]=0; continue; }
    const ci = nearestColor(data[i], data[i+1], data[i+2], palette);
    const [pr,pg,pb] = hexToRgb(palette[ci]);
    out[i]=pr;out[i+1]=pg;out[i+2]=pb;out[i+3]=a;
  }

  await sharp(out, { raw: { width, height, channels: 4 } }).png().toFile(outputPath);
  return { outputPath, palette };
}

export async function swapPalette(imagePath, colorMap, outputPath) {
  mkdirSync(path.dirname(outputPath), { recursive: true });

  const { data, info } = await sharp(imagePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const lookupFrom = Object.keys(colorMap).map(hexToRgb);
  const lookupTo = Object.values(colorMap).map(hexToRgb);

  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i+3];
    let r = data[i], g = data[i+1], b = data[i+2];
    let best = -1, bestDist = 900; // only swap close matches
    for (let j = 0; j < lookupFrom.length; j++) {
      const d = Math.abs(r-lookupFrom[j][0])+Math.abs(g-lookupFrom[j][1])+Math.abs(b-lookupFrom[j][2]);
      if (d < bestDist) { bestDist = d; best = j; }
    }
    if (best >= 0 && bestDist < 30) {
      [r,g,b] = lookupTo[best];
    }
    out[i]=r;out[i+1]=g;out[i+2]=b;out[i+3]=a;
  }

  await sharp(out, { raw: { width, height, channels: 4 } }).png().toFile(outputPath);
  return outputPath;
}

export function applySwapPreset(basePalette, presetName) {
  const fn = SWAP_PRESETS[presetName];
  if (!fn) throw new Error(`Unknown swap preset: ${presetName}`);
  const newColors = fn(basePalette);
  return Object.fromEntries(basePalette.map((c,i) => [c, newColors[i]]));
}
