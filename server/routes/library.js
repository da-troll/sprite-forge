/**
 * Sprite library + remix history
 * GET  /api/library               — list all sprites
 * GET  /api/library/:id           — full sprite detail
 * POST /api/library/:id/remix     — remix style (new style from same anchor)
 * POST /api/library/:id/extend    — extend with new cycle
 * DELETE /api/library/:id         — delete sprite
 */
import { Router } from 'express';
import path from 'path';
import { LIBRARY_DIR, MEDIA_BASE } from '../config.js';
import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import { generateImage } from '../imgen.js';
import { buildCyclePrompt, buildAnchorPrompt } from '../prompter.js';
import { embedAnchorSheet } from '../scorer.js';
import { mkdirSync, writeFileSync } from 'fs';

const router = Router();

function mediaUrl(p) { return p?.replace(LIBRARY_DIR, MEDIA_BASE); }

function formatSprite(sprite, cycles, layers) {
  return {
    ...sprite,
    refImagePaths: JSON.parse(sprite.ref_image_paths || '[]'),
    anchorUrl: mediaUrl(sprite.anchor_sheet_path),
    cycles: cycles.map(c => ({
      ...c,
      frames: JSON.parse(c.frame_paths || '[]').map(fp => ({ url: mediaUrl(fp), path: fp })),
      sheetUrl: mediaUrl(c.sprite_sheet_path),
      gifUrl: mediaUrl(c.gif_path),
      scoringResults: JSON.parse(c.scoring_results || '[]'),
    })),
    layers: layers.map(l => ({ ...l, url: mediaUrl(l.image_path) })),
  };
}

router.get('/', (req, res) => {
  const db = getDb();
  const sprites = db.prepare(`SELECT id, name, style_preset, description, anchor_sheet_path, created_at
    FROM sprites ORDER BY created_at DESC`).all();

  const cycles = db.prepare(`SELECT sprite_id, COUNT(*) as cycle_count FROM cycles GROUP BY sprite_id`).all();
  const cycleMap = Object.fromEntries(cycles.map(c => [c.sprite_id, c.cycle_count]));

  res.json(sprites.map(s => ({
    ...s,
    anchorUrl: mediaUrl(s.anchor_sheet_path),
    cycleCount: cycleMap[s.id] || 0,
  })));
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const sprite = db.prepare('SELECT * FROM sprites WHERE id = ?').get(req.params.id);
  if (!sprite) return res.status(404).json({ error: 'not found' });
  const cycles = db.prepare('SELECT * FROM cycles WHERE sprite_id = ? ORDER BY created_at').all(req.params.id);
  const layers = db.prepare('SELECT * FROM layers WHERE sprite_id = ? ORDER BY created_at').all(req.params.id);
  res.json(formatSprite(sprite, cycles, layers));
});

router.post('/:id/remix', async (req, res) => {
  try {
    const db = getDb();
    const orig = db.prepare('SELECT * FROM sprites WHERE id = ?').get(req.params.id);
    if (!orig) return res.status(404).json({ error: 'not found' });

    const { stylePreset = '16bit-jrpg', name } = req.body;
    const newId = uuidv4();
    const dir = path.join(LIBRARY_DIR, newId);
    mkdirSync(dir, { recursive: true });

    const prompt = await buildAnchorPrompt(orig.description, stylePreset);
    const anchorPath = path.join(dir, 'anchor.png');
    await generateImage({ prompt, size: '1024x1024', quality: 'high', outputPath: anchorPath });
    const embeddings = await embedAnchorSheet(anchorPath);

    db.prepare(`INSERT INTO sprites (id, name, style_preset, description, ref_image_paths, anchor_sheet_path, anchor_embeddings)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      newId, name || `${orig.name} (${stylePreset})`, stylePreset,
      orig.description, orig.ref_image_paths, anchorPath, JSON.stringify(embeddings),
    );

    res.json({ id: newId, anchorUrl: mediaUrl(anchorPath) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM sprites WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
