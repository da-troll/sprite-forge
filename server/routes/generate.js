/**
 * Core generation pipeline:
 * POST /api/generate/anchor     — anchor sheet from references
 * POST /api/generate/layers     — paper-doll layer generation
 * POST /api/generate/cycle      — animation cycle frames
 * POST /api/generate/regen-frame — manual frame regen
 */
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';

import { getDb } from '../db.js';
import { generateImage } from '../imgen.js';
import { buildAnchorPrompt, buildLayerPrompt, buildCyclePrompt, getStylePreset, describeReference } from '../prompter.js';
import { embedAnchorSheet, scoreFrames, scoreFrame } from '../scorer.js';
import { LIBRARY_DIR, MEDIA_BASE, DINOV2_REGEN_MAX } from '../config.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// ---- helpers ----
function spriteDir(id) {
  const d = path.join(LIBRARY_DIR, id);
  mkdirSync(d, { recursive: true });
  return d;
}

function mediaUrl(absPath) {
  return absPath.replace(LIBRARY_DIR, MEDIA_BASE);
}

// ---- POST /api/generate/anchor ----
router.post('/anchor', upload.array('refs', 3), async (req, res) => {
  try {
    const { description, stylePreset = '16bit-jrpg', name, quality: reqQuality } = req.body;
    if (!description) return res.status(400).json({ error: 'description required' });
    const anchorQuality = ['low', 'medium', 'high', 'auto'].includes(reqQuality) ? reqQuality : 'high';

    const db = getDb();
    const id = uuidv4();
    const dir = spriteDir(id);

    // Save uploaded refs
    const refPaths = [];
    if (req.files?.length) {
      for (const f of req.files) {
        const rp = path.join(dir, `ref_${refPaths.length}${path.extname(f.originalname) || '.png'}`);
        writeFileSync(rp, f.buffer);
        refPaths.push(rp);
      }
    }

    // Vision-enrich description from refs (parallel)
    let enrichedDescription = description;
    if (refPaths.length > 0) {
      console.log(`[anchor] Vision-describing ${refPaths.length} reference(s)...`);
      const visionDescs = await Promise.all(refPaths.map(p => describeReference(p)));
      const valid = visionDescs.filter(Boolean);
      if (valid.length > 0) {
        enrichedDescription = `${description}\n\nFROM REFERENCE IMAGE: ${valid.join(' | ')}`;
        console.log('[anchor] Vision-enriched description ready');
      }
    }

    // Build prompt — labels each ref by role (first = primary identity)
    const refRoles = refPaths.map((_, i) => i === 0 ? 'PRIMARY identity' : `additional ${i === 1 ? 'pose' : 'style'} reference`);
    console.log('[anchor] Building prompt for:', description.slice(0, 40), `(${refPaths.length} refs)`);
    const prompt = await buildAnchorPrompt(enrichedDescription, stylePreset, refRoles);
    console.log(`[anchor] Calling gpt-image-2 ${refPaths.length > 0 ? 'EDIT' : 'GENERATE'} endpoint...`);
    const anchorPath = path.join(dir, 'anchor.png');
    await generateImage({
      prompt,
      refs: refPaths,
      inputFidelity: 'high',
      size: '1024x1024',
      quality: anchorQuality,
      outputPath: anchorPath,
    });
    console.log('[anchor] Image generated:', anchorPath);

    // Embed anchor for scoring (non-fatal — first model load can be slow)
    let embeddings = [];
    try {
      embeddings = await embedAnchorSheet(anchorPath);
    } catch (embErr) {
      console.warn('[anchor] Embedding failed (scoring disabled for this sprite):', embErr.message);
    }

    db.prepare(`INSERT INTO sprites (id, name, style_preset, description, ref_image_paths, anchor_sheet_path, anchor_embeddings)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      id,
      name || description.slice(0, 50),
      stylePreset,
      enrichedDescription,
      JSON.stringify(refPaths),
      anchorPath,
      JSON.stringify(embeddings),
    );

    res.json({
      id,
      anchorUrl: mediaUrl(anchorPath),
      anchorPath,
      stylePreset,
      preset: getStylePreset(stylePreset),
    });
  } catch (err) {
    console.error('/generate/anchor', err);
    res.status(500).json({ error: err.message });
  }
});

// ---- POST /api/generate/layers ----
router.post('/layers', async (req, res) => {
  try {
    const { spriteId, layerTypes = ['base', 'clothing', 'weapon'], quality: reqQuality } = req.body;
    if (!spriteId) return res.status(400).json({ error: 'spriteId required' });
    const layerQuality = ['low', 'medium', 'high', 'auto'].includes(reqQuality) ? reqQuality : 'medium';

    const db = getDb();
    const sprite = db.prepare('SELECT * FROM sprites WHERE id = ?').get(spriteId);
    if (!sprite) return res.status(404).json({ error: 'sprite not found' });

    const dir = spriteDir(spriteId);
    const results = [];

    for (const layerType of layerTypes) {
      const layerId = uuidv4();
      const outPath = path.join(dir, `layer_${layerType}.png`);
      const prompt = buildLayerPrompt(sprite.description, layerType, sprite.style_preset);

      // Pass anchor as reference — model knows the canonical character design
      console.log(`[layers] ${layerType}: edit-from-anchor`);
      await generateImage({
        prompt,
        refs: [sprite.anchor_sheet_path],
        inputFidelity: 'high',
        size: '1024x1024',
        quality: layerQuality,
        outputPath: outPath,
      });

      db.prepare(`INSERT INTO layers (id, sprite_id, layer_type, label, image_path) VALUES (?, ?, ?, ?, ?)`)
        .run(layerId, spriteId, layerType, layerType, outPath);

      results.push({ id: layerId, layerType, url: mediaUrl(outPath) });
    }

    res.json({ layers: results });
  } catch (err) {
    console.error('/generate/layers', err);
    res.status(500).json({ error: err.message });
  }
});

// ---- POST /api/generate/cycle ----
// Fire-and-forget. Inserts cycle row immediately with status='running',
// returns cycleId, kicks off frame generation in background.
// Frontend polls GET /api/generate/cycle/:cycleId to follow progress.
router.post('/cycle', async (req, res) => {
  try {
    const { spriteId, cycleName, frameCount: reqFrameCount, quality: reqQuality } = req.body;
    if (!spriteId || !cycleName) return res.status(400).json({ error: 'spriteId and cycleName required' });
    const quality = ['low', 'medium', 'high', 'auto'].includes(reqQuality) ? reqQuality : 'medium';

    const db = getDb();
    const sprite = db.prepare('SELECT * FROM sprites WHERE id = ?').get(spriteId);
    if (!sprite) return res.status(404).json({ error: 'sprite not found' });

    const styleConfig = getStylePreset(sprite.style_preset);
    const frameCount = Math.max(1, Math.min(16, parseInt(reqFrameCount, 10) || styleConfig.cycleDefaults?.frameCount || 6));

    const dir = path.join(spriteDir(spriteId), cycleName);
    mkdirSync(dir, { recursive: true });

    const cycleId = uuidv4();
    const now = Math.floor(Date.now() / 1000);

    // Insert cycle row with status='running' so it shows up immediately
    db.prepare(`INSERT INTO cycles
      (id, sprite_id, cycle_name, frame_paths, frame_count, scoring_results, status, frames_complete, quality, updated_at)
      VALUES (?, ?, ?, '[]', ?, '[]', 'running', 0, ?, ?)`)
      .run(cycleId, spriteId, cycleName, frameCount, quality, now);

    res.json({ cycleId, status: 'running', frameCount, quality });

    // Kick off background work — DO NOT await
    runCycleJob(cycleId, sprite, cycleName, frameCount, quality).catch(err => {
      console.error(`[cycle ${cycleId.slice(0,8)}] FATAL:`, err);
      try {
        getDb().prepare(`UPDATE cycles SET status='error', error_message=?, updated_at=? WHERE id=?`)
          .run(err.message || 'unknown error', Math.floor(Date.now() / 1000), cycleId);
      } catch {}
    });
  } catch (err) {
    console.error('/generate/cycle', err);
    res.status(500).json({ error: err.message });
  }
});

// Background job — generates frames sequentially, persists each to DB as it lands
async function runCycleJob(cycleId, sprite, cycleName, frameCount, quality) {
  const db = getDb();
  const styleConfig = getStylePreset(sprite.style_preset);
  const anchorEmbeddings = JSON.parse(sprite.anchor_embeddings || '[]');

  const dir = path.join(spriteDir(sprite.id), cycleName);
  mkdirSync(dir, { recursive: true });

  const framePaths = [];
  const scoringResults = [];
  console.log(`[cycle ${cycleId.slice(0,8)}] start: ${cycleName} ${frameCount} frames @ ${quality}`);

    // Stream progress via SSE would be ideal but for now just generate all frames
  for (let i = 0; i < frameCount; i++) {
    let framePath = path.join(dir, `frame_${i.toString().padStart(2,'0')}.png`);
    console.log(`[cycle ${cycleId.slice(0,8)}] frame ${i+1}/${frameCount}: edit-from-anchor`);
    const prompt = buildCyclePrompt(sprite.description, cycleName, i, frameCount, sprite.style_preset);

    await generateImage({
      prompt,
      refs: [sprite.anchor_sheet_path],
      inputFidelity: 'high',
      size: '1024x1024',
      quality,
      outputPath: framePath,
    });

    // Score as guard rail
    let attempts = 0;
    let scoreResult;
    if (anchorEmbeddings.length > 0) {
      scoreResult = await scoreFrame(framePath, anchorEmbeddings);
      while (!scoreResult.pass && attempts < DINOV2_REGEN_MAX) {
        console.log(`[cycle ${cycleId.slice(0,8)}] frame ${i} score ${scoreResult.score.toFixed(3)} < threshold, regen ${attempts+1}`);
        const regenPath = path.join(dir, `frame_${i.toString().padStart(2,'0')}_regen${attempts+1}.png`);
        await generateImage({
          prompt,
          refs: [sprite.anchor_sheet_path],
          inputFidelity: 'high',
          size: '1024x1024',
          quality,
          outputPath: regenPath,
        });
        const newScore = await scoreFrame(regenPath, anchorEmbeddings);
        if (newScore.score > scoreResult.score) {
          framePath = regenPath;
          scoreResult = newScore;
        }
        attempts++;
      }
    }

    framePaths.push(framePath);
    scoringResults.push({ frameIndex: i, attempts, score: scoreResult?.score ?? null, pass: scoreResult?.pass ?? true });

    // Persist incremental progress so a restart never loses work
    db.prepare(`UPDATE cycles SET frame_paths=?, scoring_results=?, frames_complete=?, updated_at=? WHERE id=?`)
      .run(JSON.stringify(framePaths), JSON.stringify(scoringResults), framePaths.length, Math.floor(Date.now()/1000), cycleId);
  }

  // Build sprite sheet (horizontal strip)
  const { default: sharp } = await import('sharp');
  const frames = await Promise.all(framePaths.map(fp => sharp(fp).resize(128, 128, { fit: 'fill' }).toBuffer()));
  const sheetPath = path.join(spriteDir(sprite.id), `${cycleName}_sheet.png`);
  await sharp({
    create: { width: 128 * frameCount, height: 128, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  }).composite(frames.map((buf, i) => ({ input: buf, left: i * 128, top: 0 }))).png().toFile(sheetPath);

  // Build GIF
  const { spawnSync } = await import('child_process');
  const gifPath = path.join(spriteDir(sprite.id), `${cycleName}.gif`);
  const gifScript = path.join(path.dirname(new URL(import.meta.url).pathname), '../processors/make_gif.py');
  const gifResult = spawnSync('python3', [
    gifScript,
    '--frames', ...framePaths,
    '--gif-out', gifPath,
    '--size', '128',
    '--fps', String(styleConfig.cycleDefaults?.fps || 8),
  ], { encoding: 'utf8' });
  if (gifResult.status !== 0) console.warn(`[cycle ${cycleId.slice(0,8)}] GIF gen:`, gifResult.stderr);

  db.prepare(`UPDATE cycles SET sprite_sheet_path=?, gif_path=?, status='complete', updated_at=? WHERE id=?`)
    .run(sheetPath, gifPath, Math.floor(Date.now()/1000), cycleId);

  console.log(`[cycle ${cycleId.slice(0,8)}] complete: ${framePaths.length} frames`);
}

// ---- GET /api/generate/cycle/:cycleId ----
// Status polling endpoint — frontend uses this to follow progress
router.get('/cycle/:cycleId', (req, res) => {
  const db = getDb();
  const cycle = db.prepare('SELECT * FROM cycles WHERE id = ?').get(req.params.cycleId);
  if (!cycle) return res.status(404).json({ error: 'cycle not found' });

  const framePaths = JSON.parse(cycle.frame_paths || '[]');
  const scoringResults = JSON.parse(cycle.scoring_results || '[]');

  res.json({
    cycleId: cycle.id,
    cycleName: cycle.cycle_name,
    spriteId: cycle.sprite_id,
    status: cycle.status || 'complete',
    framesComplete: cycle.frames_complete ?? framePaths.length,
    frameCount: cycle.frame_count,
    quality: cycle.quality,
    errorMessage: cycle.error_message,
    frames: framePaths.map((fp, i) => ({
      index: i,
      url: mediaUrl(fp),
      score: scoringResults[i]?.score ?? null,
      pass: scoringResults[i]?.pass ?? null,
      attempts: scoringResults[i]?.attempts ?? 0,
    })),
    sheetUrl: cycle.sprite_sheet_path ? mediaUrl(cycle.sprite_sheet_path) : null,
    gifUrl: cycle.gif_path ? mediaUrl(cycle.gif_path) : null,
    scoringResults,
  });
});

// ---- POST /api/generate/regen-frame ----
router.post('/regen-frame', async (req, res) => {
  try {
    const { cycleId, frameIndex, quality: reqQuality } = req.body;
    if (cycleId === undefined || frameIndex === undefined) return res.status(400).json({ error: 'cycleId and frameIndex required' });
    const quality = ['low', 'medium', 'high', 'auto'].includes(reqQuality) ? reqQuality : 'medium';

    const db = getDb();
    const cycle = db.prepare('SELECT c.*, s.description, s.style_preset, s.anchor_embeddings, s.anchor_sheet_path FROM cycles c JOIN sprites s ON c.sprite_id=s.id WHERE c.id=?').get(cycleId);
    if (!cycle) return res.status(404).json({ error: 'cycle not found' });

    const framePaths = JSON.parse(cycle.frame_paths);
    const anchorEmbeddings = JSON.parse(cycle.anchor_embeddings || '[]');
    const frameCount = cycle.frame_count;

    const oldPath = framePaths[frameIndex];
    const dir = path.dirname(oldPath);
    const regenPath = path.join(dir, `frame_${frameIndex.toString().padStart(2,'0')}_manual_${Date.now()}.png`);

    const prompt = buildCyclePrompt(cycle.description, cycle.cycle_name, frameIndex, frameCount, cycle.style_preset);
    await generateImage({
      prompt,
      refs: [cycle.anchor_sheet_path],
      inputFidelity: 'high',
      size: '1024x1024',
      quality,
      outputPath: regenPath,
    });

    const scoreResult = anchorEmbeddings.length > 0
      ? await scoreFrame(regenPath, anchorEmbeddings)
      : { score: null, pass: true };

    framePaths[frameIndex] = regenPath;
    db.prepare('UPDATE cycles SET frame_paths=? WHERE id=?').run(JSON.stringify(framePaths), cycleId);

    db.prepare(`INSERT INTO regen_history (id, sprite_id, cycle_id, frame_index, reason, score_before, score_after)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      uuidv4(), cycle.sprite_id, cycleId, frameIndex, 'manual',
      null, scoreResult.score,
    );

    res.json({ frameIndex, url: mediaUrl(regenPath), ...scoreResult });
  } catch (err) {
    console.error('/generate/regen-frame', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
