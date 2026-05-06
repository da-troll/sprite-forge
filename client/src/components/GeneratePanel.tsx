import React, { useState, useRef } from 'react';
import { generateAnchor, generateLayers, transcribeVoice, type ImageQuality } from '../api';
import QualitySelector from './QualitySelector';
import type { Sprite } from '../App';

const STYLE_PRESETS = [
  { id: '16bit-jrpg', label: '16-bit JRPG', emoji: '🗡️' },
  { id: 'gba-pokemon', label: 'GBA Pokémon', emoji: '⭐' },
  { id: 'cel-shaded-anime', label: 'Cel-Shaded Anime', emoji: '✨' },
  { id: 'chibi', label: 'Chibi', emoji: '🐱' },
  { id: 'vampire-survivors', label: 'Vampire Survivors', emoji: '🧛' },
  { id: 'cyberpunk-pixel', label: 'Cyberpunk Pixel', emoji: '🤖' },
  { id: 'ghibli', label: 'Studio Ghibli', emoji: '🌿' },
  { id: 'nes', label: 'NES 8-bit', emoji: '👾' },
];

const LAYER_TYPES = ['base', 'clothing', 'accessory', 'weapon', 'prop'];

export default function GeneratePanel({ onCreated }: { onCreated: (s: Sprite) => void }) {
  const [description, setDescription] = useState('');
  const [stylePreset, setStylePreset] = useState('16bit-jrpg');
  const [name, setName] = useState('');
  const [refs, setRefs] = useState<File[]>([]);
  const [selectedLayers, setSelectedLayers] = useState<string[]>(['base', 'clothing', 'weapon']);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [anchorQuality, setAnchorQuality] = useState<ImageQuality>('high');
  const [layerQuality, setLayerQuality] = useState<ImageQuality>('medium');
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function handleGenerate() {
    if (!description.trim()) { setError('Description required'); return; }
    setError(null); setResult(null);

    const form = new FormData();
    form.append('description', description);
    form.append('stylePreset', stylePreset);
    form.append('name', name || description.slice(0, 50));
    form.append('quality', anchorQuality);
    refs.forEach(f => form.append('refs', f));

    setStatus(`Generating anchor sheet at ${anchorQuality} quality (4-angle view)...`);
    const anchor = await generateAnchor(form);
    if (anchor.error) { setError(anchor.error); setStatus(null); return; }

    setResult({ ...anchor, step: 'anchor' });
    setStatus(`Anchor ready. Generating ${selectedLayers.length} layers at ${layerQuality} quality...`);

    const layers = await generateLayers(anchor.id, selectedLayers, layerQuality);
    if (layers.error) { setError(layers.error); setStatus(null); return; }

    setStatus(null);
    setResult({ ...anchor, layers: layers.layers, step: 'done' });
    onCreated({ id: anchor.id, name: name || description.slice(0,50), description, style_preset: stylePreset, anchorUrl: anchor.anchorUrl });
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setStatus('Transcribing...');
        const r = await transcribeVoice(blob);
        if (r.text) setDescription(prev => (prev ? prev + ' ' : '') + r.text);
        setStatus(null);
      };
      mr.start();
      mediaRef.current = mr;
      setIsRecording(true);
    } catch { setError('Microphone access denied'); }
  }

  function stopRecording() {
    mediaRef.current?.stop();
    setIsRecording(false);
  }

  function toggleLayer(l: string) {
    setSelectedLayers(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]);
  }

  return (
    <div style={S.root}>
      <h2 style={S.title}>⚔️ Forge New Sprite</h2>
      <p style={S.sub}>Describe your character. We'll generate a 4-angle anchor sheet, then build paper-doll layers.</p>

      <div style={S.row}>
        <div style={S.field}>
          <label style={S.label}>Name (optional)</label>
          <input style={S.input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Dark Knight, Forest Elf..." />
        </div>
      </div>

      <div style={S.field}>
        <label style={S.label}>Character Description</label>
        <div style={S.textRow}>
          <textarea
            style={S.textarea}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe your character: appearance, outfit, weapons, personality... Be specific!"
            rows={4}
          />
          <button
            style={{ ...S.micBtn, ...(isRecording ? S.micBtnActive : {}) }}
            onClick={isRecording ? stopRecording : startRecording}
            title={isRecording ? 'Stop recording' : 'Voice input'}
          >
            {isRecording ? '⏹' : '🎤'}
          </button>
        </div>
      </div>

      <div style={S.field}>
        <label style={S.label}>Style Preset</label>
        <div style={S.presetGrid}>
          {STYLE_PRESETS.map(p => (
            <button
              key={p.id}
              style={{ ...S.presetBtn, ...(stylePreset === p.id ? S.presetBtnActive : {}) }}
              onClick={() => setStylePreset(p.id)}
            >
              <span style={{ fontSize: 20 }}>{p.emoji}</span>
              <span style={{ fontSize: 11 }}>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={S.field}>
        <label style={S.label}>Paper-doll Layers to Generate</label>
        <div style={S.layerRow}>
          {LAYER_TYPES.map(l => (
            <label key={l} style={S.layerCheck}>
              <input type="checkbox" checked={selectedLayers.includes(l)} onChange={() => toggleLayer(l)} />
              {l}
            </label>
          ))}
        </div>
      </div>

      <div style={S.field}>
        <label style={S.label}>Generation Quality</label>
        <div style={S.qualityRow}>
          <QualitySelector value={anchorQuality} onChange={setAnchorQuality} label="Anchor Sheet" disabled={!!status} />
          <QualitySelector value={layerQuality} onChange={setLayerQuality} label="Paper-doll Layers" disabled={!!status} />
        </div>
      </div>

      <div style={S.field}>
        <label style={S.label}>Reference Images (up to 3, optional)</label>
        <input
          type="file" accept="image/*" multiple
          onChange={e => setRefs(Array.from(e.target.files || []).slice(0,3))}
          style={S.fileInput}
        />
        {refs.length > 0 && (
          <div style={S.refPreviews}>
            {refs.map((f, i) => (
              <img key={i} src={URL.createObjectURL(f)} alt="" style={S.refImg} />
            ))}
          </div>
        )}
      </div>

      {error && <div style={S.error}>{error}</div>}
      {status && <div style={S.status}><span style={S.spinner}>⏳</span> {status}</div>}

      <button style={S.btn} onClick={handleGenerate} disabled={!!status}>
        {status ? 'Generating...' : '🔥 Generate Sprite'}
      </button>

      {result?.step === 'done' && (
        <div style={S.resultBox}>
          <h3 style={S.resultTitle}>✅ Sprite Created!</h3>
          <div style={S.resultImages}>
            <div>
              <div style={S.imgLabel}>Anchor Sheet</div>
              <img src={result.anchorUrl} alt="anchor" style={S.resultImg} />
            </div>
            {result.layers?.map((l: any) => (
              <div key={l.id}>
                <div style={S.imgLabel}>{l.layerType}</div>
                <img src={l.url} alt={l.layerType} style={S.resultImg} />
              </div>
            ))}
          </div>
          <div style={S.hint}>→ Head to Cycles tab to animate your sprite</div>
        </div>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  root: { maxWidth: 800, margin: '0 auto' },
  title: { fontSize: 24, color: '#b39dff', marginBottom: 8, fontWeight: 700 },
  sub: { color: '#8888aa', marginBottom: 24, fontSize: 14 },
  row: { display: 'flex', gap: 16 },
  field: { marginBottom: 20 },
  label: { display: 'block', fontSize: 12, color: '#8888aa', marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' },
  input: { width: '100%', background: '#1a1a3a', border: '1px solid #7c4dff40', borderRadius: 6, color: '#e0e0ff', padding: '10px 14px', fontSize: 14, outline: 'none' },
  textRow: { display: 'flex', gap: 8, alignItems: 'flex-start' },
  textarea: { flex: 1, background: '#1a1a3a', border: '1px solid #7c4dff40', borderRadius: 6, color: '#e0e0ff', padding: '10px 14px', fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit' },
  micBtn: { background: '#1e1e44', border: '1px solid #7c4dff40', borderRadius: 6, color: '#b39dff', cursor: 'pointer', fontSize: 20, padding: '10px 14px' },
  micBtnActive: { background: '#7c0000', border: '1px solid #ff4d4d' },
  presetGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 },
  presetBtn: { background: '#1a1a3a', border: '1px solid #7c4dff30', borderRadius: 8, color: '#8888aa', cursor: 'pointer', padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transition: 'all 0.15s' },
  presetBtnActive: { background: '#2a1a5a', border: '1px solid #7c4dff', color: '#b39dff' },
  layerRow: { display: 'flex', gap: 16, flexWrap: 'wrap' },
  qualityRow: { display: 'flex', gap: 24, flexWrap: 'wrap' },
  layerCheck: { display: 'flex', alignItems: 'center', gap: 6, color: '#b39dff', cursor: 'pointer', fontSize: 14 },
  fileInput: { color: '#8888aa', fontSize: 13 },
  refPreviews: { display: 'flex', gap: 10, marginTop: 8 },
  refImg: { width: 80, height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid #7c4dff40' },
  error: { background: '#2a0a0a', border: '1px solid #ff4d4d40', borderRadius: 6, padding: '10px 14px', color: '#ff6b6b', marginBottom: 12, fontSize: 14 },
  status: { background: '#0a1a3a', border: '1px solid #7c4dff40', borderRadius: 6, padding: '10px 14px', color: '#b39dff', marginBottom: 12, fontSize: 14 },
  spinner: { marginRight: 8 },
  btn: { background: '#7c4dff', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', padding: '14px 32px', fontSize: 16, fontWeight: 700, letterSpacing: 1, transition: 'all 0.15s' },
  resultBox: { marginTop: 24, background: '#0d1a2d', border: '1px solid #7c4dff30', borderRadius: 12, padding: 20 },
  resultTitle: { color: '#b39dff', marginBottom: 16, fontSize: 16 },
  resultImages: { display: 'flex', gap: 16, flexWrap: 'wrap' },
  imgLabel: { fontSize: 11, color: '#8888aa', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  resultImg: { width: 160, height: 160, objectFit: 'contain', borderRadius: 6, background: '#1a1a3a', imageRendering: 'pixelated' },
  hint: { marginTop: 16, color: '#7c7ca0', fontSize: 13 },
};
