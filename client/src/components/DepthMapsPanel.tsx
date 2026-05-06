import React, { useState } from 'react';
import { buildDepthMaps, buildBulkDepthMaps } from '../api';
import type { Sprite, Cycle } from '../App';

export default function DepthMapsPanel({ sprite, cycle }: { sprite: Sprite; cycle: Cycle }) {
  const [maps, setMaps] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState<number | 'bulk' | null>(null);
  const [activeFrame, setActiveFrame] = useState(0);

  async function handleBuild(frameIndex: number) {
    setLoading(frameIndex);
    const r = await buildDepthMaps(cycle.id, frameIndex);
    setLoading(null);
    if (!r.error) setMaps(prev => ({ ...prev, [frameIndex]: r }));
  }

  async function handleBulk() {
    setLoading('bulk');
    const r = await buildBulkDepthMaps(cycle.id);
    setLoading(null);
    if (r.maps) {
      const newMaps: Record<number, any> = {};
      r.maps.forEach((m: any) => { newMaps[m.frameIndex] = m; });
      setMaps(prev => ({ ...prev, ...newMaps }));
    }
  }

  const activeMap = maps[activeFrame];

  return (
    <div style={S.root}>
      <h2 style={S.title}>🗺️ HD-2D Maps — {sprite.name} / {cycle.cycle_name}</h2>
      <p style={S.sub}>Per-frame diffuse, depth, normal, and emission maps for game engine integration.</p>

      <div style={S.controls}>
        <button style={S.bulkBtn} onClick={handleBulk} disabled={loading === 'bulk'}>
          {loading === 'bulk' ? '⏳ Building all...' : '📦 Build All Frames'}
        </button>
      </div>

      <div style={S.frameSelector}>
        {cycle.frames.map((f, i) => (
          <div
            key={i}
            style={{ ...S.framePill, ...(activeFrame === i ? S.framePillActive : {}), ...(maps[i] ? S.framePillDone : {}) }}
            onClick={() => setActiveFrame(i)}
          >
            {maps[i] ? '✅' : i}
          </div>
        ))}
      </div>

      <div style={S.content}>
        <div style={S.frameCol}>
          <div style={S.frameLabel}>Frame {activeFrame}</div>
          {cycle.frames[activeFrame] && (
            <img src={cycle.frames[activeFrame].url} alt="" style={S.frameImg} />
          )}
          {!maps[activeFrame] && (
            <button
              style={S.buildBtn}
              onClick={() => handleBuild(activeFrame)}
              disabled={loading === activeFrame}
            >
              {loading === activeFrame ? '⏳ Building...' : '🗺️ Build Maps'}
            </button>
          )}
        </div>

        {activeMap && (
          <div style={S.mapsGrid}>
            {[
              { key: 'diffuseUrl', label: 'Diffuse', icon: '🖼️' },
              { key: 'depthUrl', label: 'Depth', icon: '📏' },
              { key: 'normalUrl', label: 'Normal', icon: '🧭' },
              { key: 'emissionUrl', label: 'Emission', icon: '✨' },
            ].map(({ key, label, icon }) => (
              activeMap[key] && (
                <div key={key} style={S.mapCard}>
                  <div style={S.mapLabel}>{icon} {label}</div>
                  <img src={activeMap[key]} alt={label} style={S.mapImg} />
                  <a href={activeMap[key]} download style={S.downloadBtn}>⬇ Download</a>
                </div>
              )
            ))}
          </div>
        )}
      </div>

      <div style={S.info}>
        <div style={S.infoTitle}>📋 Engine Integration</div>
        <div style={S.infoGrid}>
          <div style={S.infoItem}><strong>Diffuse:</strong> Base colour texture → Standard albedo/diffuse slot</div>
          <div style={S.infoItem}><strong>Depth:</strong> Greyscale 0–255 → Displacement or parallax shader</div>
          <div style={S.infoItem}><strong>Normal:</strong> RGB-encoded XYZ → Normal map slot (DirectX or OpenGL convention)</div>
          <div style={S.infoItem}><strong>Emission:</strong> Black + glow → Emission/self-illumination slot</div>
        </div>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  root: { maxWidth: 900 },
  title: { fontSize: 22, color: '#b39dff', marginBottom: 8 },
  sub: { color: '#8888aa', fontSize: 13, marginBottom: 20 },
  controls: { marginBottom: 16 },
  bulkBtn: { background: '#7c4dff', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', padding: '10px 24px', fontSize: 14, fontWeight: 600 },
  frameSelector: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 },
  framePill: { background: '#1a1a3a', border: '1px solid #7c4dff30', borderRadius: 6, color: '#8888aa', cursor: 'pointer', padding: '4px 12px', fontSize: 13, transition: 'all 0.15s' },
  framePillActive: { border: '1px solid #7c4dff', color: '#b39dff', background: '#2a1a5a' },
  framePillDone: { borderColor: '#4caf50', color: '#4caf50' },
  content: { display: 'flex', gap: 24, alignItems: 'flex-start' },
  frameCol: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  frameLabel: { fontSize: 12, color: '#8888aa', letterSpacing: 1 },
  frameImg: { width: 160, height: 160, objectFit: 'contain', imageRendering: 'pixelated', background: '#1a1a3a', borderRadius: 8 },
  buildBtn: { background: '#7c4dff40', border: '1px solid #7c4dff', borderRadius: 6, color: '#b39dff', cursor: 'pointer', padding: '8px 18px', fontSize: 13 },
  mapsGrid: { flex: 1, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 },
  mapCard: { background: '#1a1a3a', border: '1px solid #7c4dff30', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  mapLabel: { fontSize: 13, color: '#b39dff', fontWeight: 600 },
  mapImg: { width: 140, height: 140, objectFit: 'contain', imageRendering: 'pixelated', background: '#111', borderRadius: 6 },
  downloadBtn: { color: '#7c4dff', fontSize: 12, textDecoration: 'none' },
  info: { marginTop: 24, background: '#0d1a2d', border: '1px solid #7c4dff20', borderRadius: 10, padding: 16 },
  infoTitle: { fontSize: 14, color: '#b39dff', marginBottom: 12, fontWeight: 600 },
  infoGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 },
  infoItem: { fontSize: 12, color: '#8888aa', lineHeight: 1.6 },
};
