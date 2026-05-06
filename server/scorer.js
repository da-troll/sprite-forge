/**
 * Visual identity scoring via @xenova/transformers image-feature-extraction.
 * Uses ViT-base (21k classes) — matches DINOv2's semantic similarity capability
 * and correctly uses the image-feature-extraction pipeline (no tokenizer needed).
 */
import { pipeline, env, RawImage } from '@xenova/transformers';
import sharp from 'sharp';
import path from 'path';
import { MODELS_DIR, DINOV2_THRESHOLD } from './config.js';

env.cacheDir = MODELS_DIR;
env.allowLocalModels = true;

let _extractor = null;

async function getExtractor() {
  if (!_extractor) {
    console.log('[scorer] Loading ViT image embedding model...');
    _extractor = await pipeline(
      'image-feature-extraction',
      'Xenova/vit-base-patch16-224-in21k',
      { revision: 'main' }
    );
    console.log('[scorer] ViT model ready');
  }
  return _extractor;
}

async function embedImagePath(imagePath) {
  const extractor = await getExtractor();
  const result = await extractor(imagePath, { pooling: 'mean', normalize: true });
  return Array.from(result.data);
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export async function embedAnchorSheet(anchorPath) {
  const meta = await sharp(anchorPath).metadata();
  const w = meta.width, h = meta.height;
  const hw = Math.floor(w / 2), hh = Math.floor(h / 2);

  const quadrantCoords = [
    { left: 0, top: 0, width: hw, height: hh },
    { left: hw, top: 0, width: hw, height: hh },
    { left: 0, top: hh, width: hw, height: hh },
    { left: hw, top: hh, width: hw, height: hh },
  ];

  const embeddings = [];
  for (let qi = 0; qi < quadrantCoords.length; qi++) {
    const q = quadrantCoords[qi];
    const tmpPath = `/tmp/anchor_q${qi}_${Date.now()}.png`;
    await sharp(anchorPath).extract(q).png().toFile(tmpPath);
    const emb = await embedImagePath(tmpPath);
    embeddings.push(emb);
  }
  return embeddings;
}

export async function scoreFrame(framePath, anchorEmbeddings) {
  if (!anchorEmbeddings || anchorEmbeddings.length === 0) {
    return { score: null, best: null, perQuadrant: [], pass: true };
  }
  try {
    const frameEmb = await embedImagePath(framePath);
    const scores = anchorEmbeddings.map(ae => cosine(ae, frameEmb));
    const best = Math.max(...scores);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return { score: avg, best, perQuadrant: scores, pass: avg >= DINOV2_THRESHOLD };
  } catch (err) {
    console.warn('[scorer] scoreFrame failed:', err.message);
    return { score: null, best: null, perQuadrant: [], pass: true };
  }
}

export async function scoreFrames(framePaths, anchorEmbeddings) {
  const results = [];
  for (const fp of framePaths) {
    const r = await scoreFrame(fp, anchorEmbeddings);
    results.push({ path: fp, ...r });
  }
  return results;
}
