import React, { useState } from 'react';
import { createScene } from '../api';
import type { Sprite } from '../App';

const SCENE_STYLES = [
  'pixel art dungeon', 'forest clearing', 'cyber city neon', 'underwater cavern',
  'floating sky islands', 'volcanic wasteland', 'enchanted forest', 'space station',
];

export default function SceneCompositor({ sprites }: { sprites: Sprite[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sceneStyle, setSceneStyle] = useState('pixel art dungeon');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleSprite(id: string) {
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(id)) { s.delete(id); }
      else if (s.size < 3) { s.add(id); }
      return s;
    });
  }

  async function handleCompose() {
    if (selected.size < 2) { setError('Select at least 2 sprites'); return; }
    setError(null); setLoading(true);
    const r = await createScene([...selected], sceneStyle, name);
    setLoading(false);
    if (r.error) { setError(r.error); return; }
    setResult(r);
  }

  return (
    <div style={S.root}>
      <h2 style={S.title}>🎭 Scene Compositor</h2>
      <p style={S.sub}>Drop 2–3 sprites into a generated environment. Creates a shareable composited scene.</p>

      <div style={S.section}>
        <h3 style={S.sectionTitle}>Select Sprites (2–3)</h3>
        {sprites.length === 0 && (
          <div style={S.empty}>No sprites in library yet. Forge some first!</div>
        )}
        <div style={S.spriteGrid}>
          {sprites.map(s => (
            <div
              key={s.id}
              style={{ ...S.spritePick, ...(selected.has(s.id) ? S.spritePickActive : {}) }}
              onClick={() => toggleSprite(s.id)}
            >
              {s.anchorUrl && <img src={s.anchorUrl} alt={s.name} style={S.pickImg} />}
              <div style={S.pickName}>{s.name}</div>
              {selected.has(s.id) && <div style={S.checkmark}>✅</div>}
            </div>
          ))}
        </div>
        <div style={S.selCount}>{selected.size}/3 sprites selected</div>
      </div>

      <div style={S.section}>
        <h3 style={S.sectionTitle}>Scene Style</h3>
        <div style={S.styleGrid}>
          {SCENE_STYLES.map(st => (
            <button
              key={st}
              style={{ ...S.styleBtn, ...(sceneStyle === st ? S.styleBtnActive : {}) }}
              onClick={() => setSceneStyle(st)}
            >
              {st}
            </button>
          ))}
        </div>
        <div style={S.field}>
          <input
            style={S.input}
            placeholder="Scene name (optional)"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
      </div>

      {error && <div style={S.error}>{error}</div>}

      <button style={S.composeBtn} onClick={handleCompose} disabled={loading || selected.size < 2}>
        {loading ? '⏳ Compositing...' : '🎭 Generate Scene'}
      </button>

      {result && (
        <div style={S.resultBox}>
          <h3 style={S.resultTitle}>✅ Scene Ready</h3>
          <img src={result.compositeUrl} alt="scene" style={S.compositeImg} />
          <div style={S.resultActions}>
            <a href={result.compositeUrl} download style={S.dlBtn}>⬇ Download PNG</a>
            {result.shareUrl && (
              <button style={S.shareBtn} onClick={() => navigator.clipboard.writeText(window.location.origin + result.shareUrl)}>
                🔗 Copy Share URL
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  root: { maxWidth: 900 },
  title: { fontSize: 22, color: '#b39dff', marginBottom: 8 },
  sub: { color: '#8888aa', fontSize: 13, marginBottom: 24 },
  section: { background: '#111130', border: '1px solid #7c4dff30', borderRadius: 12, padding: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 16, color: '#b39dff', marginBottom: 14 },
  empty: { color: '#8888aa', fontSize: 14, padding: '20px 0' },
  spriteGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, marginBottom: 10 },
  spritePick: { background: '#1a1a3a', border: '1px solid #7c4dff30', borderRadius: 8, padding: 10, cursor: 'pointer', textAlign: 'center', position: 'relative', transition: 'all 0.15s' },
  spritePickActive: { border: '1px solid #4caf50', background: '#0d2a1a' },
  pickImg: { width: 80, height: 80, objectFit: 'contain', imageRendering: 'pixelated', marginBottom: 6 },
  pickName: { fontSize: 11, color: '#b39dff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  checkmark: { position: 'absolute', top: 4, right: 4, fontSize: 14 },
  selCount: { fontSize: 12, color: '#8888aa' },
  styleGrid: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  styleBtn: { background: '#1a1a3a', border: '1px solid #7c4dff30', borderRadius: 6, color: '#8888aa', cursor: 'pointer', padding: '7px 14px', fontSize: 12 },
  styleBtnActive: { background: '#2a1a5a', border: '1px solid #7c4dff', color: '#b39dff' },
  field: { marginTop: 8 },
  input: { width: '100%', background: '#1a1a3a', border: '1px solid #7c4dff40', borderRadius: 6, color: '#e0e0ff', padding: '10px 14px', fontSize: 14, outline: 'none' },
  error: { background: '#2a0a0a', border: '1px solid #ff4d4d40', borderRadius: 6, padding: '10px 14px', color: '#ff6b6b', marginBottom: 12 },
  composeBtn: { background: '#7c4dff', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', padding: '14px 32px', fontSize: 16, fontWeight: 700, letterSpacing: 1 },
  resultBox: { marginTop: 24, background: '#0d1a2d', border: '1px solid #4caf5040', borderRadius: 12, padding: 20 },
  resultTitle: { color: '#4caf50', marginBottom: 16, fontSize: 16 },
  compositeImg: { maxWidth: '100%', borderRadius: 8, marginBottom: 16, imageRendering: 'pixelated' },
  resultActions: { display: 'flex', gap: 12 },
  dlBtn: { background: '#1a1a3a', border: '1px solid #7c4dff40', borderRadius: 6, color: '#b39dff', padding: '8px 16px', textDecoration: 'none', fontSize: 13 },
  shareBtn: { background: '#7c4dff40', border: '1px solid #7c4dff', borderRadius: 6, color: '#b39dff', cursor: 'pointer', padding: '8px 16px', fontSize: 13 },
};
