/**
 * Palette quantization + swap routes
 * POST /api/palette/quantize     — quantize sprite to palette
 * POST /api/palette/swap         — apply color map swap
 * POST /api/palette/preset-swap  — apply named swap preset (player-2, ice, fire, shadow-clone)
 * GET  /api/palette/presets      — list presets + palettes
 */
import { Router } from 'express';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { quantizeImage, swapPalette, applySwapPreset, PALETTES } from '../palette.js';
import { LIBRARY_DIR, MEDIA_BASE } from '../config.js';

const router = Router();
function mediaUrl(p) { return p?.replace(LIBRARY_DIR, MEDIA_BASE); }

router.get('/presets', (req, res) => {
  res.json({
    palettes: Object.keys(PALETTES),
    swaps: ['player-2', 'ice', 'fire', 'shadow-clone'],
  });
});

router.post('/quantize', async (req, res) => {
  try {
    const { spriteId, cycleId, paletteName = 'pico-8', customColors } = req.body;
    if (!spriteId) return res.status(400).json({ error: 'spriteId required' });

    const db = getDb();
    const sprite = db.prepare('SELECT * FROM sprites WHERE id = ?').get(spriteId);
    if (!sprite) return res.status(404).json({ error: 'sprite not found' });

    const dir = path.join(LIBRARY_DIR, spriteId, 'palette');
    const outPath = path.join(dir, `quantized_${paletteName}_${Date.now()}.png`);

    // Quantize the anchor sheet as representative
    const srcPath = sprite.anchor_sheet_path;
    const { outputPath, palette } = await quantizeImage(srcPath, paletteName, customColors, outPath);

    const variantId = uuidv4();
    db.prepare(`INSERT INTO palette_variants (id, sprite_id, palette_name, color_map, preview_path)
      VALUES (?, ?, ?, ?, ?)`).run(variantId, spriteId, paletteName, JSON.stringify(palette), outPath);

    res.json({ variantId, url: mediaUrl(outPath), palette });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/swap', async (req, res) => {
  try {
    const { spriteId, colorMap, label } = req.body;
    if (!spriteId || !colorMap) return res.status(400).json({ error: 'spriteId and colorMap required' });

    const db = getDb();
    const sprite = db.prepare('SELECT * FROM sprites WHERE id = ?').get(spriteId);
    if (!sprite) return res.status(404).json({ error: 'sprite not found' });

    const outPath = path.join(LIBRARY_DIR, spriteId, 'palette', `swap_custom_${Date.now()}.png`);
    await swapPalette(sprite.anchor_sheet_path, colorMap, outPath);

    const variantId = uuidv4();
    db.prepare(`INSERT INTO palette_variants (id, sprite_id, palette_name, color_map, preview_path)
      VALUES (?, ?, ?, ?, ?)`).run(variantId, spriteId, label || 'custom-swap', JSON.stringify(colorMap), outPath);

    res.json({ variantId, url: mediaUrl(outPath) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/preset-swap', async (req, res) => {
  try {
    const { spriteId, presetName } = req.body;
    if (!spriteId || !presetName) return res.status(400).json({ error: 'spriteId and presetName required' });

    const db = getDb();
    const sprite = db.prepare('SELECT * FROM sprites WHERE id = ?').get(spriteId);
    if (!sprite) return res.status(404).json({ error: 'sprite not found' });

    // Extract the sprite's dominant palette first then apply swap
    const { palette: basePalette } = await quantizeImage(
      sprite.anchor_sheet_path, 'auto', null,
      path.join(LIBRARY_DIR, spriteId, 'palette', `base_extract_${Date.now()}.png`)
    );

    const colorMap = applySwapPreset(basePalette, presetName);
    const outPath = path.join(LIBRARY_DIR, spriteId, 'palette', `swap_${presetName}_${Date.now()}.png`);
    await swapPalette(sprite.anchor_sheet_path, colorMap, outPath);

    const variantId = uuidv4();
    db.prepare(`INSERT INTO palette_variants (id, sprite_id, palette_name, color_map, preview_path)
      VALUES (?, ?, ?, ?, ?)`).run(variantId, spriteId, presetName, JSON.stringify(colorMap), outPath);

    res.json({ variantId, url: mediaUrl(outPath), colorMap });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
