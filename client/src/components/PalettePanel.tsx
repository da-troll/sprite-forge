import React, { useState } from 'react';
import { quantizePalette, presetSwap } from '../api';
import type { Sprite } from '../App';

const PALETTES = ['pico-8', 'nes', 'gba', 'custom'];
const SWAPS = [
  { id: 'player-2', label: 'Player 2', emoji: '🔵', desc: 'Hue shift +120° — classic P2 colour variant' },
  { id: 'ice', label: 'Ice', emoji: '❄️', desc: 'Cold blue-white tint' },
  { id: 'fire', label: 'Fire', emoji: '🔥', desc: 'Orange-red glow tint' },
  { id: 'shadow-clone', label: 'Shadow Clone', emoji: '🌑', desc: 'Dark purple shadow variant' },
];

export default function PalettePanel({ sprite }: { sprite: Sprite }) {
  const [selectedPalette, setSelectedPalette] = useState('pico-8');
  const [quantResult, setQuantResult] = useState<any>(null);
  const [swapResults, setSwapResults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<string | null>(null);

  async function handleQuantize() {
    setLoading('quantize');
    const r = await quantizePalette(sprite.id, selectedPalette);
    setLoading(null);
    if (!r.error) setQuantResult(r);
  }

  async function handleSwap(presetName: string) {
    setLoading(presetName);
    const r = await presetSwap(sprite.id, presetName);
    setLoading(null);
    if (!r.error) setSwapResults(prev => ({ ...prev, [presetName]: r }));
  }

  return (
    <div style={S.root}>
      <h2 style={S.title}>🎨 Palette Lab — {sprite.name}</h2>

      <div style={S.section}>
        <h3 style={S.sectionTitle}>Palette Quantization</h3>
        <p style={S.sectionSub}>Snap sprite colours to authentic retro palettes.</p>
        <div style={S.palRow}>
          {PALETTES.map(p => (
            <button
              key={p}
              style={{ ...S.palBtn, ...(selectedPalette === p ? S.palBtnActive : {}) }}
              onClick={() => setSelectedPalette(p)}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
        <button style={S.actionBtn} onClick={handleQuantize} disabled={loading === 'quantize'}>
          {loading === 'quantize' ? '⏳ Quantizing...' : '🎨 Quantize to ' + selectedPalette.toUpperCase()}
        </button>
        {quantResult && (
          <div style={S.resultRow}>
            <img src={quantResult.url} alt="quantized" style={S.previewImg} />
            <div style={S.paletteChips}>
              {(quantResult.palette || []).slice(0, 16).map((c: string, i: number) => (
                <div key={i} style={{ ...S.chip, background: c }} title={c} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={S.section}>
        <h3 style={S.sectionTitle}>One-Click Palette Swaps</h3>
        <p style={S.sectionSub}>Remap colors for instant character variants. No redraw.</p>
        <div style={S.swapGrid}>
          {SWAPS.map(sw => (
            <div key={sw.id} style={S.swapCard}>
              <div style={S.swapEmoji}>{sw.emoji}</div>
              <div style={S.swapLabel}>{sw.label}</div>
              <div style={S.swapDesc}>{sw.desc}</div>
              <button
                style={S.swapBtn}
                onClick={() => handleSwap(sw.id)}
                disabled={loading === sw.id}
              >
                {loading === sw.id ? '⏳' : 'Apply'}
              </button>
              {swapResults[sw.id] && (
                <img src={swapResults[sw.id].url} alt={sw.label} style={S.swapPreview} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  root: { maxWidth: 900 },
  title: { fontSize: 22, color: '#b39dff', marginBottom: 24 },
  section: { background: '#111130', border: '1px solid #7c4dff30', borderRadius: 12, padding: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 16, color: '#b39dff', marginBottom: 6 },
  sectionSub: { color: '#8888aa', fontSize: 13, marginBottom: 14 },
  palRow: { display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' },
  palBtn: { background: '#1a1a3a', border: '1px solid #7c4dff30', borderRadius: 6, color: '#8888aa', cursor: 'pointer', padding: '8px 16px', fontSize: 12, letterSpacing: 1 },
  palBtnActive: { background: '#2a1a5a', border: '1px solid #7c4dff', color: '#b39dff' },
  actionBtn: { background: '#7c4dff', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', padding: '10px 24px', fontSize: 14, fontWeight: 600, marginBottom: 16 },
  resultRow: { display: 'flex', alignItems: 'flex-start', gap: 16 },
  previewImg: { width: 200, height: 200, objectFit: 'contain', imageRendering: 'pixelated', background: '#1a1a3a', borderRadius: 6 },
  paletteChips: { display: 'flex', flexWrap: 'wrap', gap: 6, alignContent: 'flex-start' },
  chip: { width: 24, height: 24, borderRadius: 3, border: '1px solid #7c4dff20' },
  swapGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 },
  swapCard: { background: '#1a1a3a', border: '1px solid #7c4dff30', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' },
  swapEmoji: { fontSize: 32 },
  swapLabel: { fontSize: 15, fontWeight: 600, color: '#e0e0ff' },
  swapDesc: { fontSize: 12, color: '#8888aa' },
  swapBtn: { background: '#7c4dff40', border: '1px solid #7c4dff', borderRadius: 6, color: '#b39dff', cursor: 'pointer', padding: '6px 20px', fontSize: 13 },
  swapPreview: { width: 120, height: 120, objectFit: 'contain', imageRendering: 'pixelated', background: '#111', borderRadius: 6 },
};
