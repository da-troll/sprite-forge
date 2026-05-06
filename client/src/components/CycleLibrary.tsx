import React, { useState, useRef, useEffect } from 'react';
import { generateCycle, regenFrame, getCycleStatus, type ImageQuality } from '../api';
import QualitySelector from './QualitySelector';
import type { Sprite, Cycle } from '../App';

const CYCLES = [
  { id: 'idle', label: 'Idle', emoji: '🧍', defaultFrames: 4 },
  { id: 'walk', label: 'Walk', emoji: '🚶', defaultFrames: 8 },
  { id: 'run', label: 'Run', emoji: '🏃', defaultFrames: 8 },
  { id: 'attack', label: 'Attack', emoji: '⚔️', defaultFrames: 6 },
  { id: 'hurt', label: 'Hurt', emoji: '💥', defaultFrames: 4 },
  { id: 'jump', label: 'Jump', emoji: '🦘', defaultFrames: 6 },
  { id: 'cast', label: 'Cast', emoji: '✨', defaultFrames: 8 },
  { id: 'death', label: 'Death', emoji: '💀', defaultFrames: 6 },
];

interface JobState {
  cycleId: string;
  cycleName: string;
  frameCount: number;
  framesComplete: number;
  status: 'running' | 'complete' | 'error';
}

export default function CycleLibrary({
  sprite, activeCycle, setActiveCycle, onRefresh,
}: {
  sprite: Sprite;
  activeCycle: Cycle | null;
  setActiveCycle: (c: Cycle) => void;
  onRefresh: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [hoveredFrame, setHoveredFrame] = useState<number | null>(null);
  const [regenning, setRegenning] = useState<number | null>(null);
  const [quality, setQuality] = useState<ImageQuality>('medium');
  const [frameCount, setFrameCount] = useState<number>(8);
  const [activeJob, setActiveJob] = useState<JobState | null>(null);
  const pollRef = useRef<number | null>(null);

  // Poll active job
  useEffect(() => {
    if (!activeJob || activeJob.status !== 'running') return;
    let cancelled = false;

    async function tick() {
      const r = await getCycleStatus(activeJob!.cycleId);
      if (cancelled) return;
      if (r.error) { setError(r.error); setActiveJob(null); return; }
      setActiveJob({
        cycleId: r.cycleId,
        cycleName: r.cycleName,
        frameCount: r.frameCount,
        framesComplete: r.framesComplete ?? 0,
        status: r.status,
      });
      if (r.status === 'complete') {
        onRefresh();
        setTimeout(() => setActiveJob(null), 1500);
      } else if (r.status === 'error') {
        setError(r.errorMessage || 'cycle generation failed');
      }
    }

    pollRef.current = window.setInterval(tick, 6000);
    tick();
    return () => {
      cancelled = true;
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [activeJob?.cycleId, activeJob?.status]);

  async function handleGenerate(cycleName: string, count: number) {
    setError(null);
    const result = await generateCycle(sprite.id, cycleName, count, quality);
    if (result.error) { setError(result.error); return; }
    setActiveJob({
      cycleId: result.cycleId,
      cycleName,
      frameCount: result.frameCount,
      framesComplete: 0,
      status: 'running',
    });
  }

  async function handleRegen(frameIndex: number) {
    if (!activeCycle) return;
    setRegenning(frameIndex);
    await regenFrame(activeCycle.id, frameIndex, quality);
    setRegenning(null);
    onRefresh();
  }

  const generatingCycle = activeJob?.cycleName ?? null;

  return (
    <div style={S.root}>
      <div style={S.titleRow}>
        <h2 style={S.title}>🎬 Animation Cycles — {sprite.name}</h2>
        <div style={S.controls}>
          <div style={S.frameCountWrap}>
            <label style={S.fcLabel}>Frames</label>
            <input
              type="number"
              min={1}
              max={16}
              value={frameCount}
              onChange={e => setFrameCount(Math.max(1, Math.min(16, parseInt(e.target.value, 10) || 1)))}
              disabled={!!activeJob}
              style={S.frameCountInput}
            />
          </div>
          <QualitySelector value={quality} onChange={setQuality} disabled={!!activeJob} />
        </div>
      </div>

      {activeJob && activeJob.status === 'running' && (
        <div style={S.progressBar}>
          <div style={S.progressLabel}>
            ⏳ Generating <strong>{activeJob.cycleName}</strong> — frame {activeJob.framesComplete}/{activeJob.frameCount}
            <span style={S.progressNote}>
              (each frame is saved as it lands — page is safe to refresh)
            </span>
          </div>
          <div style={S.progressTrack}>
            <div style={{ ...S.progressFill, width: `${(activeJob.framesComplete / activeJob.frameCount) * 100}%` }} />
          </div>
        </div>
      )}

      {activeJob && activeJob.status === 'complete' && (
        <div style={S.successBar}>✅ {activeJob.cycleName} cycle complete</div>
      )}

      <div style={S.cycleGrid}>
        {CYCLES.map(c => {
          const existing = sprite.cycles?.find(ec => ec.cycle_name === c.id);
          const isGenerating = generatingCycle === c.id;
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
                  onClick={e => { e.stopPropagation(); handleGenerate(c.id, frameCount); }}
                  disabled={!!activeJob}
                >
                  {isGenerating ? '⏳ Gen...' : `+ Generate (${frameCount}f)`}
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
                    title="Regenerate this frame at the selected quality"
                  >
                    {regenning === i ? '⏳' : '🔄'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div style={S.exports}>
            {activeCycle.sheetUrl && <a href={activeCycle.sheetUrl} target="_blank" rel="noreferrer" style={S.exportBtn}>📥 Sprite Sheet</a>}
            {activeCycle.gifUrl && <a href={activeCycle.gifUrl} target="_blank" rel="noreferrer" style={S.exportBtn}>🎞️ GIF</a>}
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
  controls: { display: 'flex', gap: 16, alignItems: 'flex-end' },
  frameCountWrap: { display: 'flex', flexDirection: 'column', gap: 6 },
  fcLabel: { fontSize: 11, color: '#8888aa', letterSpacing: 1, textTransform: 'uppercase' },
  frameCountInput: { width: 64, background: '#111128', border: '1px solid #7c4dff20', borderRadius: 8, color: '#b39dff', padding: '8px 10px', fontSize: 14, textAlign: 'center', outline: 'none' },
  progressBar: { background: '#0d1a2d', border: '1px solid #7c4dff60', borderRadius: 10, padding: '14px 16px', marginBottom: 16 },
  progressLabel: { color: '#b39dff', fontSize: 14, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 4 },
  progressNote: { color: '#7c7ca0', fontSize: 11, fontWeight: 400 },
  progressTrack: { height: 6, background: '#1a1a3a', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', background: 'linear-gradient(90deg, #7c4dff, #b39dff)', transition: 'width 0.5s ease-out' },
  successBar: { background: '#0d2a1a', border: '1px solid #4caf5060', color: '#4caf50', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 14 },
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
