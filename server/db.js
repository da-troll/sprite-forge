import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../data/sprite-forge.db');

let _db;
export function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    migrate(_db);
  }
  return _db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sprites (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      style_preset TEXT,
      description TEXT,
      ref_image_paths TEXT,       -- JSON array
      anchor_sheet_path TEXT,
      anchor_embeddings TEXT,     -- JSON array of per-quadrant embedding vectors
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS layers (
      id TEXT PRIMARY KEY,
      sprite_id TEXT NOT NULL REFERENCES sprites(id) ON DELETE CASCADE,
      layer_type TEXT NOT NULL,   -- base | clothing | accessory | weapon | prop
      label TEXT NOT NULL,
      image_path TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS cycles (
      id TEXT PRIMARY KEY,
      sprite_id TEXT NOT NULL REFERENCES sprites(id) ON DELETE CASCADE,
      cycle_name TEXT NOT NULL,   -- walk | run | idle | attack | hurt | jump | cast | death
      frame_paths TEXT,           -- JSON array
      sprite_sheet_path TEXT,
      gif_path TEXT,
      frame_count INTEGER,
      scoring_results TEXT,       -- JSON: per-frame cosine scores
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS depth_maps (
      id TEXT PRIMARY KEY,
      cycle_id TEXT NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
      frame_index INTEGER NOT NULL,
      diffuse_path TEXT,
      depth_path TEXT,
      normal_path TEXT,
      emission_path TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS palette_variants (
      id TEXT PRIMARY KEY,
      sprite_id TEXT NOT NULL REFERENCES sprites(id) ON DELETE CASCADE,
      palette_name TEXT NOT NULL,
      color_map TEXT NOT NULL,    -- JSON: originalHex -> newHex
      preview_path TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS scenes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sprite_ids TEXT NOT NULL,   -- JSON array
      background_path TEXT,
      composite_path TEXT,
      share_token TEXT UNIQUE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS regen_history (
      id TEXT PRIMARY KEY,
      sprite_id TEXT NOT NULL,
      cycle_id TEXT,
      frame_index INTEGER,
      reason TEXT,
      score_before REAL,
      score_after REAL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
}
