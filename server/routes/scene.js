/**
 * Multi-character scene compositor
 * POST /api/scene/create         — compose 2-3 sprites onto generated background
 * GET  /api/scene/:id            — get scene
 * GET  /api/scene/share/:token   — shareable URL data
 */
import { Router } from 'express';
import path from 'path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { generateImage } from '../imgen.js';
import { buildBackgroundPrompt } from '../prompter.js';
import { LIBRARY_DIR, MEDIA_BASE } from '../config.js';
import { mkdirSync } from 'fs';

const router = Router();
function mediaUrl(p) { return p?.replace(LIBRARY_DIR, MEDIA_BASE); }

router.post('/create', async (req, res) => {
  try {
    const { spriteIds, sceneStyle, name } = req.body;
    if (!spriteIds?.length || spriteIds.length < 2) return res.status(400).json({ error: 'at least 2 spriteIds required' });

    const db = getDb();
    const sprites = spriteIds.map(id => db.prepare('SELECT * FROM sprites WHERE id = ?').get(id)).filter(Boolean);
    if (sprites.length < 2) return res.status(400).json({ error: 'sprites not found' });

    const sceneId = uuidv4();
    const shareToken = uuidv4().replace(/-/g,'').slice(0,16);
    const sceneDir = path.join(LIBRARY_DIR, 'scenes', sceneId);
    mkdirSync(sceneDir, { recursive: true });

    // Generate background
    const bgDesc = sprites.map(s => s.description).join(', ');
    const bgPath = path.join(sceneDir, 'background.png');
    const bgPrompt = await buildBackgroundPrompt(bgDesc, sceneStyle);
    await generateImage({ prompt: bgPrompt, size: '1024x1024', outputPath: bgPath });

    // Composite sprites onto background
    const bgMeta = await sharp(bgPath).metadata();
    const W = bgMeta.width, H = bgMeta.height;
    const spriteW = Math.floor(W * 0.25);

    const composites = [];
    for (let i = 0; i < sprites.length; i++) {
      const spriteAnchor = sprites[i].anchor_sheet_path;
      // Extract front-facing quadrant (top-left)
      const meta = await sharp(spriteAnchor).metadata();
      const qw = Math.floor(meta.width / 2), qh = Math.floor(meta.height / 2);
      const frontBuf = await sharp(spriteAnchor)
        .extract({ left: 0, top: 0, width: qw, height: qh })
        .resize(spriteW, Math.floor(spriteW * 1.2), { fit: 'contain', background: { r:0,g:0,b:0,alpha:0 } })
        .toBuffer();

      const spacing = Math.floor(W / (sprites.length + 1));
      const left = spacing * (i + 1) - Math.floor(spriteW / 2);
      const top = H - Math.floor(spriteW * 1.2) - 20;
      composites.push({ input: frontBuf, left, top });
    }

    const compositePath = path.join(sceneDir, 'composite.png');
    await sharp(bgPath)
      .composite(composites)
      .png()
      .toFile(compositePath);

    db.prepare(`INSERT INTO scenes (id, name, sprite_ids, background_path, composite_path, share_token)
      VALUES (?, ?, ?, ?, ?, ?)`).run(
      sceneId, name || `Scene ${sceneId.slice(0,8)}`,
      JSON.stringify(spriteIds), bgPath, compositePath, shareToken,
    );

    res.json({
      id: sceneId,
      shareToken,
      shareUrl: `/scene/share/${shareToken}`,
      backgroundUrl: mediaUrl(bgPath),
      compositeUrl: mediaUrl(compositePath),
    });
  } catch (err) {
    console.error('/scene/create', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/share/:token', (req, res) => {
  const db = getDb();
  const scene = db.prepare('SELECT * FROM scenes WHERE share_token = ?').get(req.params.token);
  if (!scene) return res.status(404).json({ error: 'scene not found' });

  const spriteIds = JSON.parse(scene.sprite_ids);
  const sprites = spriteIds.map(id => db.prepare('SELECT id, name, description, style_preset FROM sprites WHERE id=?').get(id)).filter(Boolean);
  const cycles = spriteIds.flatMap(id =>
    db.prepare('SELECT cycle_name, gif_path, sprite_sheet_path FROM cycles WHERE sprite_id=? ORDER BY created_at').all(id)
  );

  res.json({
    scene: { ...scene, compositeUrl: mediaUrl(scene.composite_path) },
    sprites,
    cycles: cycles.map(c => ({ ...c, gifUrl: mediaUrl(c.gif_path), sheetUrl: mediaUrl(c.sprite_sheet_path) })),
  });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const scene = db.prepare('SELECT * FROM scenes WHERE id = ?').get(req.params.id);
  if (!scene) return res.status(404).json({ error: 'not found' });
  res.json({ ...scene, compositeUrl: mediaUrl(scene.composite_path), backgroundUrl: mediaUrl(scene.background_path) });
});

export default router;
