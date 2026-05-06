/**
 * HD-2D depth/normal/emission map generation
 * POST /api/depth/build          — build full map bundle for a frame
 * POST /api/depth/bulk           — build maps for entire cycle
 * GET  /api/depth/:cycleId       — list maps for a cycle
 */
import { Router } from 'express';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { buildDepthMapBundle } from '../depthmaps.js';
import { LIBRARY_DIR, MEDIA_BASE } from '../config.js';

const router = Router();
function mediaUrl(p) { return p?.replace(LIBRARY_DIR, MEDIA_BASE); }

router.post('/build', async (req, res) => {
  try {
    const { cycleId, frameIndex } = req.body;
    if (!cycleId || frameIndex === undefined) return res.status(400).json({ error: 'cycleId and frameIndex required' });

    const db = getDb();
    const cycle = db.prepare('SELECT c.*, s.description FROM cycles c JOIN sprites s ON c.sprite_id=s.id WHERE c.id=?').get(cycleId);
    if (!cycle) return res.status(404).json({ error: 'cycle not found' });

    const framePaths = JSON.parse(cycle.frame_paths);
    const framePath = framePaths[frameIndex];
    const outDir = path.join(LIBRARY_DIR, cycle.sprite_id, cycle.cycle_name, 'maps');

    const maps = await buildDepthMapBundle(framePath, cycle.description, outDir);

    const mapId = uuidv4();
    db.prepare(`INSERT INTO depth_maps (id, cycle_id, frame_index, diffuse_path, depth_path, normal_path, emission_path)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(mapId, cycleId, frameIndex, maps.diffuse, maps.depth, maps.normal, maps.emission);

    res.json({
      id: mapId,
      frameIndex,
      diffuseUrl: mediaUrl(maps.diffuse),
      depthUrl: mediaUrl(maps.depth),
      normalUrl: mediaUrl(maps.normal),
      emissionUrl: mediaUrl(maps.emission),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bulk', async (req, res) => {
  try {
    const { cycleId } = req.body;
    if (!cycleId) return res.status(400).json({ error: 'cycleId required' });

    const db = getDb();
    const cycle = db.prepare('SELECT c.*, s.description FROM cycles c JOIN sprites s ON c.sprite_id=s.id WHERE c.id=?').get(cycleId);
    if (!cycle) return res.status(404).json({ error: 'cycle not found' });

    const framePaths = JSON.parse(cycle.frame_paths);
    const outDir = path.join(LIBRARY_DIR, cycle.sprite_id, cycle.cycle_name, 'maps');
    const results = [];

    for (let i = 0; i < framePaths.length; i++) {
      const maps = await buildDepthMapBundle(framePaths[i], cycle.description, outDir);
      const mapId = uuidv4();
      db.prepare(`INSERT INTO depth_maps (id, cycle_id, frame_index, diffuse_path, depth_path, normal_path, emission_path)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).run(mapId, cycleId, i, maps.diffuse, maps.depth, maps.normal, maps.emission);
      results.push({ id: mapId, frameIndex: i, ...Object.fromEntries(
        Object.entries(maps).map(([k,v]) => [`${k}Url`, mediaUrl(v)])
      )});
    }

    res.json({ maps: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:cycleId', (req, res) => {
  const db = getDb();
  const maps = db.prepare('SELECT * FROM depth_maps WHERE cycle_id = ? ORDER BY frame_index').all(req.params.cycleId);
  res.json(maps.map(m => ({
    ...m,
    diffuseUrl: mediaUrl(m.diffuse_path),
    depthUrl: mediaUrl(m.depth_path),
    normalUrl: mediaUrl(m.normal_path),
    emissionUrl: mediaUrl(m.emission_path),
  })));
});

export default router;
