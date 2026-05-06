import React, { useState } from 'react';
import { generateCycle, regenFrame, type ImageQuality } from '../api';
import type { Sprite, Cycle } from '../App';

const QUALITY_OPTIONS: { id: ImageQuality; label: string; latency: string }[] = [
  { id: 'low',    label: 'Low',    latency: '~25s/frame' },
  { id: 'medium', label: 'Medium', latency: '~60s/frame' },
  { id: 'high',   label: 'High',   latency: '~120s/frame' },
  { id: 'auto',   label: 'Auto',   latency: 'model picks' },
];

const CYCLES = [
  { id: 'idle', label: 'Idle', emoji: '🧍', frames: 4 },
  { id: 'walk', label: 'Walk', emoji: '🚶', frames: 8 },
  { id: 'run', label: 'Run', emoji: '🏃', frames: 8 },
  { id: 'attack', label: 'Attack', emoji: '⚔️', frames: 6 },
  { id: 'hurt', label: 'Hurt', emoji: '💥', frames: 4 },
  { id: 'jump', label: 'Jump', emoji: '🦘', frames: 6 },
  { id: 'cast', label: 'Cast', emoji: '✨', frames: 8 },
  { id: 'death', label: 'Death', emoji: '💀', frames: 6 },
];

export default function CycleLibrary({
  sprite, activeCycle, setActiveCycle, onRefresh,
}: {
  sprite: Sprite;
  activeCycle: Cycle | null;
  setActiveCycle: (c: Cycle) => void;
  onRefresh: () => void;
}) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoveredFrame, setHoveredFrame] = useState<number | null>(null);
  const [regenning, setRegenning] = useState<number | null>(null);
  const [quality, setQuality] = useState<ImageQuality>('medium');

  const existingCycles = new Set((sprite.cycles || []).map(c => c.cycle_name));

  async function handleGenerate(cycleName: string, frameCount: number) {
    setGenerating(cycleName);
    setError(null);
    const result = await generateCycle(sprite.id, cycleName, frameCount, quality);
    setGenerating(null);
    if (result.error) { setError(result.error); return; }
    onRefresh();
  }

  async function handleRegen(frameIndex: number) {
    if (!activeCycle) return;
    setRegenning(frameIndex);
    await regenFrame(activeCycle.id, frameIndex, quality);
    setRegenning(null);
    onRefresh();
  }

  return (
    <div style={S.root}>
      <div style={S.titleRow}>
        <h2 style={S.title}>🎬 Animation Cycles — {sprite.name}</h2>
        <div style={S.qualitySelector}>
          <label style={S.qualityLabel}>Quality</label>
          <div style={S.qualityPills}>
            {QUALITY_OPTIONS.map(q => (
              <button
                key={q.id}
                style={{ ...S.qualityPill, ...(quality === q.id ? S.qualityPillActive : {}) }}
                onClick={() => setQuality(q.id)}
                title={q.latency}
                disabled={!!generating}
              >
                {q.label}
                <span style={S.qualityHint}>{q.latency}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={S.cycleGrid}>
        {CYCLES.map(c => {
          const existing = sprite.cycles?.find(ec => ec.cycle_name === c.id);
          return (
            <div
              key={c.id}
              style={{ ...S.cycleCard, ...(activeCycle?.cycle_name === c.id ? S.cycleCardActive : {}) }}
              onClick={() => existing && setActiveCycle(existing)}
            >
              <div style={S.cycleEmoji}>{c.emoji}</div>
              <div style={S.cycleName}>{c.label}</div>
              {existing ? (
                <div style={S.cycleStatus}>
                  <div style={{ color: '#4caf50', fontSize: 11 }}>✅ {existing.frame_count} frames</div>
                  {existing.gifUrl && (
                    <img src={existing.gifUrl} alt={c.id} style={S.gifPreview} />
                  )}
                </div>
              ) : (
                <button
                  style={S.genBtn}
                  onClick={e => { e.stopPropagation(); handleGenerate(c.id, c.frames); }}
                  disabled={generating === c.id}
                >
                  {generating === c.id ? '⏳ Gen...' : '+ Generate'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {error && <div style={S.error}>{error}</div>}

      {activeCycle && (
        <div style={S.detail}>
          <h3 style={S.detailTitle}>
            {CYCLES.find(c => c.id === activeCycle.cycle_name)?.emoji} {activeCycle.cycle_name.toUpperCase()} — Frame Inspector
          </h3>
          <div style={S.scoreBar}>
            {activeCycle.scoringResults.map((sr, i) => (
              <div key={i} style={{ ...S.scoreChip, background: sr.pass ? '#1a3a1a' : '#3a1a1a', border: `1px solid ${sr.pass ? '#4caf50' : '#f44336'}` }}>
                {i}: {sr.score != null ? sr.score.toFixed(2) : 'n/a'}
              </div>
            ))}
          </div>
          <div style={S.frames}>
            {activeCycle.frames.map((f, i) => (
              <div
                key={i}
                style={{ ...S.frameWrap, ...(hoveredFrame === i ? S.frameWrapHover : {}) }}
                onMouseEnter={() => setHoveredFrame(i)}
                onMouseLeave={() => setHoveredFrame(null)}
              >
                <img src={f.url} alt={`frame ${i}`} style={S.frame} />
                <div style={S.frameOverlay}>
                  <div style={S.frameIdx}>{i}</div>
                  {f.score != null && (
                    <div style={{ ...S.frameScore, color: (f.pass ?? true) ? '#4caf50' : '#f44336' }}>
                      {f.score.toFixed(2)}
                    </div>
                  )}
                  <button
                    style={S.regenBtn}
                    onClick={() => handleRegen(i)}
                    disabled={regenning === i}
                    title="Regenerate this frame"
                  >
                    {regenning === i ? '⏳' : '🔄'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div style={S.exports}>
            <a href={activeCycle.sheetUrl} target="_blank" style={S.exportBtn}>📥 Sprite Sheet</a>
            <a href={activeCycle.gifUrl} target="_blank" style={S.exportBtn}>🎞️ GIF</a>
          </div>
        </div>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  root: {},
  titleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, gap: 16, flexWrap: 'wrap' },
  title: { fontSize: 22, color: '#b39dff' },
  qualitySelector: { display: 'flex', flexDirection: 'column', gap: 6 },
  qualityLabel: { fontSize: 11, color: '#8888aa', letterSpacing: 1, textTransform: 'uppercase' },
  qualityPills: { display: 'flex', gap: 4, background: '#111128', border: '1px solid #7c4dff20', borderRadius: 8, padding: 4 },
  qualityPill: { background: 'none', border: 'none', borderRadius: 6, color: '#8888aa', cursor: 'pointer', padding: '6px 12px', fontSize: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 64, transition: 'all 0.15s' },
  qualityPillActive: { background: '#2a1a5a', color: '#b39dff' },
  qualityHint: { fontSize: 9, color: '#7c7ca0', marginTop: 2, fontWeight: 400 },
  cycleGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 },
  cycleCard: { background: '#1a1a3a', border: '1px solid #7c4dff30', borderRadius: 10, padding: 14, cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' },
  cycleCardActive: { border: '1px solid #7c4dff', background: '#2a1a5a' },
  cycleEmoji: { fontSize: 28, marginBottom: 6 },
  cycleName: { fontSize: 13, fontWeight: 600, color: '#b39dff', marginBottom: 8 },
  cycleStatus: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  gifPreview: { width: 48, height: 48, imageRendering: 'pixelated', objectFit: 'contain' },
  genBtn: { background: '#7c4dff40', border: '1px solid #7c4dff', borderRadius: 6, color: '#b39dff', cursor: 'pointer', padding: '6px 12px', fontSize: 12 },
  error: { background: '#2a0a0a', border: '1px solid #ff4d4d40', borderRadius: 6, padding: '10px 14px', color: '#ff6b6b', marginBottom: 12 },
  detail: { background: '#111130', border: '1px solid #7c4dff30', borderRadius: 12, padding: 20 },
  detailTitle: { fontSize: 16, color: '#b39dff', marginBottom: 12 },
  scoreBar: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 },
  scoreChip: { fontSize: 11, padding: '3px 8px', borderRadius: 4, color: '#e0e0ff' },
  frames: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 },
  frameWrap: { position: 'relative', borderRadius: 6, overflow: 'hidden', border: '1px solid #7c4dff30', cursor: 'pointer', transition: 'all 0.15s' },
  frameWrapHover: { border: '1px solid #7c4dff', transform: 'scale(1.05)' },
  frame: { width: 96, height: 96, objectFit: 'contain', display: 'block', background: '#1a1a2e', imageRendering: 'pixelated' },
  frameOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 6px' },
  frameIdx: { fontSize: 10, color: '#8888aa' },
  frameScore: { fontSize: 10, fontWeight: 600 },
  regenBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: 0 },
  exports: { display: 'flex', gap: 12 },
  exportBtn: { background: '#1a1a3a', border: '1px solid #7c4dff40', borderRadius: 6, color: '#b39dff', padding: '8px 16px', textDecoration: 'none', fontSize: 13 },
};
