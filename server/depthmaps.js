/**
 * Depth map + normal map + emission mask generation.
 * - Depth: Depth Anything V2 Small via @xenova/transformers
 * - Normal: derived from depth via Sobel gradient using sharp
 * - Emission: separate gpt-image-2 pass (glow-only on black)
 */
import { pipeline, env } from '@xenova/transformers';
import sharp from 'sharp';
import path from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { MODELS_DIR } from './config.js';
import { generateImage } from './imgen.js';

env.cacheDir = MODELS_DIR;

let _depthPipeline = null;

async function getDepthPipeline() {
  if (!_depthPipeline) {
    console.log('[depth] Loading Depth Anything V2 model...');
    _depthPipeline = await pipeline('depth-estimation', 'Xenova/depth-anything-v2-small-hf');
    console.log('[depth] Depth Anything V2 ready');
  }
  return _depthPipeline;
}

export async function generateDepthMap(imagePath, outputPath) {
  const dp = await getDepthPipeline();
  const result = await dp(imagePath);
  const depthData = result.depth;

  // depthData is a RawImage — convert to PNG greyscale
  const { data, width, height } = depthData;
  const buf = Buffer.from(data);

  mkdirSync(path.dirname(outputPath), { recursive: true });
  await sharp(buf, { raw: { width, height, channels: 1 } })
    .png()
    .toFile(outputPath);

  return outputPath;
}

export async function generateNormalMap(depthPath, outputPath) {
  const { data, info } = await sharp(depthPath)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const normals = Buffer.alloc(width * height * 3);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const dzdx = (data[idx + 1] - data[idx - 1]) / 255.0;
      const dzdy = (data[(y + 1) * width + x] - data[(y - 1) * width + x]) / 255.0;

      // Sobel-derived surface normal
      let nx = -dzdx;
      let ny = -dzdy;
      let nz = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= len; ny /= len; nz /= len;

      const base = (y * width + x) * 3;
      normals[base]     = Math.round((nx * 0.5 + 0.5) * 255);
      normals[base + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normals[base + 2] = Math.round((nz * 0.5 + 0.5) * 255);
    }
  }

  mkdirSync(path.dirname(outputPath), { recursive: true });
  await sharp(normals, { raw: { width, height, channels: 3 } })
    .png()
    .toFile(outputPath);

  return outputPath;
}

export async function generateEmissionMask(spriteDescription, outputPath) {
  const prompt = `Pure black background, isolated glowing emission mask only.
No character, no body, no outline. Only emissive light areas that would glow in a game engine:
glowing eyes, magical auras, fire, electricity, runes, neon highlights.
Character description: ${spriteDescription}.
Style: pixel art emission mask for HD-2D game shader. High contrast glow on pure black.`;

  await generateImage({ prompt, size: '1024x1024', outputPath });
  return outputPath;
}

export async function buildDepthMapBundle(framePath, spriteDescription, outDir) {
  mkdirSync(outDir, { recursive: true });
  const base = path.basename(framePath, path.extname(framePath));

  const depthPath = path.join(outDir, `${base}_depth.png`);
  const normalPath = path.join(outDir, `${base}_normal.png`);
  const emissionPath = path.join(outDir, `${base}_emission.png`);

  await generateDepthMap(framePath, depthPath);
  await generateNormalMap(depthPath, normalPath);
  await generateEmissionMask(spriteDescription, emissionPath);

  return { diffuse: framePath, depth: depthPath, normal: normalPath, emission: emissionPath };
}
