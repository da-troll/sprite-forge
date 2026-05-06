import React, { useState, useEffect } from 'react';
import { getSprite } from '../api';
import type { Sprite } from '../App';

type DetailSprite = Sprite & {
  cycles?: any[];
  layers?: any[];
};

export default function SpriteLibrary({
  sprites, onSelect, onRefresh,
}: {
  sprites: Sprite[];
  onSelect: (s: Sprite) => void;
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState('');
  const [modalSprite, setModalSprite] = useState<DetailSprite | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [zoomImg, setZoomImg] = useState<string | null>(null);

  const filtered = sprites.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.description?.toLowerCase().includes(search.toLowerCase())
  );

  async function openModal(s: Sprite) {
    setModalLoading(true);
    setModalSprite({ ...s, cycles: [], layers: [] });
    const full = await getSprite(s.id);
    if (full && !full.error) setModalSprite(full);
    setModalLoading(false);
  }

  function closeModal() {
    setModalSprite(null);
    setZoomImg(null);
  }

  useEffect(() => {
    if (!modalSprite && !zoomImg) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (zoomImg) setZoomImg(null);
        else closeModal();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalSprite, zoomImg]);

  return (
    <div style={S.root}>
      <div style={S.header}>
        <h2 style={S.title}>📚 Sprite Library</h2>
        <div style={S.controls}>
          <input
            style={S.search}
            placeholder="Search sprites..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button style={S.refreshBtn} onClick={onRefresh}>🔄</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={S.empty}>
          <div style={{ fontSize: 48 }}>🎮</div>
          <div>No sprites yet. Go to Forge to create your first!</div>
        </div>
      ) : (
        <div style={S.grid}>
          {filtered.map(s => (
            <div key={s.id} style={S.card}>
              <div style={S.cardClickable} onClick={() => openModal(s)}>
                <div style={S.imgWrap}>
                  {s.anchorUrl ? (
                    <img src={s.anchorUrl} alt={s.name} style={S.img} />
                  ) : (
                    <div style={S.imgPlaceholder}>🎮</div>
                  )}
                  <div style={S.imgHint}>🔍 Click to expand</div>
                </div>
                <div style={S.cardBody}>
                  <div style={S.cardName}>{s.name}</div>
                  <div style={S.cardStyle}>{s.style_preset}</div>
                  {(s as any).cycleCount > 0 && (
                    <div style={S.cardCycles}>🎬 {(s as any).cycleCount} cycles</div>
                  )}
                  <div style={S.cardDesc}>{s.description?.slice(0, 80)}{s.description && s.description.length > 80 ? '...' : ''}</div>
                </div>
              </div>
              <div style={S.cardFooter}>
                <button style={S.useBtn} onClick={() => onSelect(s)}>Use</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalSprite && (
        <div style={S.modalBackdrop} onClick={closeModal}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div>
                <div style={S.modalName}>{modalSprite.name}</div>
                <div style={S.modalStyle}>{modalSprite.style_preset}</div>
              </div>
              <div style={S.modalActions}>
                <button style={S.modalUseBtn} onClick={() => { onSelect(modalSprite); closeModal(); }}>
                  Use Sprite →
                </button>
                <button style={S.modalCloseBtn} onClick={closeModal}>✕</button>
              </div>
            </div>

            <div style={S.modalBody}>
              <div style={S.anchorWrap} onClick={() => setZoomImg(modalSprite.anchorUrl)}>
                <img src={modalSprite.anchorUrl} alt="anchor" style={S.anchorImg} />
                <div style={S.zoomHint}>🔍 Click to zoom</div>
              </div>

              <div style={S.modalSide}>
                {modalSprite.description && (
                  <div style={S.modalSection}>
                    <div style={S.modalSectionLabel}>📝 Description</div>
                    <div style={S.modalDesc}>{modalSprite.description}</div>
                  </div>
                )}

                {modalLoading ? (
                  <div style={S.modalLoading}>⏳ Loading…</div>
                ) : (
                  <>
                    {modalSprite.layers && modalSprite.layers.length > 0 && (
                      <div style={S.modalSection}>
                        <div style={S.modalSectionLabel}>🧩 Layers ({modalSprite.layers.length})</div>
                        <div style={S.layerStrip}>
                          {modalSprite.layers.map((l: any) => (
                            <div key={l.id} style={S.layerThumb} onClick={() => setZoomImg(l.url)} title={l.layer_type}>
                              <img src={l.url} alt={l.layer_type} style={S.layerThumbImg} />
                              <div style={S.layerThumbLabel}>{l.layer_type}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {modalSprite.cycles && modalSprite.cycles.length > 0 && (
                      <div style={S.modalSection}>
                        <div style={S.modalSectionLabel}>🎬 Cycles ({modalSprite.cycles.length})</div>
                        <div style={S.cycleStrip}>
                          {modalSprite.cycles.map((c: any) => (
                            <div key={c.id} style={S.cycleThumb}>
                              {c.gifUrl && (
                                <img
                                  src={c.gifUrl}
                                  alt={c.cycle_name}
                                  style={S.cycleThumbImg}
                                  onClick={() => setZoomImg(c.gifUrl)}
                                />
                              )}
                              <div style={S.cycleThumbLabel}>{c.cycle_name}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(!modalSprite.layers?.length && !modalSprite.cycles?.length) && (
                      <div style={S.emptyHint}>
                        No layers or cycles yet. Click <strong>Use Sprite</strong> to generate animations.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {zoomImg && (
        <div style={S.zoomBackdrop} onClick={() => setZoomImg(null)}>
          <img src={zoomImg} alt="zoomed" style={S.zoomImg} />
          <div style={S.zoomCloseHint}>Click anywhere or press Esc</div>
        </div>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  root: {},
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 },
  title: { fontSize: 22, color: '#b39dff' },
  controls: { display: 'flex', gap: 8 },
  search: { background: '#1a1a3a', border: '1px solid #7c4dff40', borderRadius: 6, color: '#e0e0ff', padding: '8px 14px', fontSize: 14, outline: 'none' },
  refreshBtn: { background: '#1a1a3a', border: '1px solid #7c4dff40', borderRadius: 6, color: '#b39dff', cursor: 'pointer', padding: '8px 12px' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 80, color: '#7c7ca0', fontSize: 16 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 },
  card: { background: '#1a1a3a', border: '1px solid #7c4dff30', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'all 0.15s' },
  cardClickable: { cursor: 'zoom-in', flex: 1, display: 'flex', flexDirection: 'column' },
  imgWrap: { position: 'relative', height: 200, background: '#111128', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  img: { width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' },
  imgPlaceholder: { fontSize: 48 },
  imgHint: { position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.7)', color: '#b39dff', fontSize: 10, padding: '3px 8px', borderRadius: 4, opacity: 0.85 },
  cardBody: { padding: '12px 14px', flex: 1 },
  cardName: { fontSize: 15, fontWeight: 600, color: '#e0e0ff', marginBottom: 4 },
  cardStyle: { fontSize: 11, color: '#7c4dff', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  cardCycles: { fontSize: 11, color: '#4caf50', marginBottom: 6 },
  cardDesc: { fontSize: 12, color: '#8888aa', lineHeight: 1.4 },
  cardFooter: { padding: '8px 14px', borderTop: '1px solid #7c4dff20' },
  useBtn: { background: '#7c4dff40', border: '1px solid #7c4dff', borderRadius: 6, color: '#b39dff', cursor: 'pointer', padding: '6px 14px', fontSize: 13, width: '100%', fontWeight: 600, letterSpacing: 1 },

  // Modal
  modalBackdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24, backdropFilter: 'blur(4px)' },
  modal: { background: '#0d0d1a', border: '1px solid #7c4dff60', borderRadius: 16, maxWidth: 1100, width: '100%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #7c4dff30', background: '#14143a' },
  modalName: { fontSize: 20, fontWeight: 700, color: '#e0e0ff' },
  modalStyle: { fontSize: 12, color: '#7c4dff', letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 },
  modalActions: { display: 'flex', gap: 10, alignItems: 'center' },
  modalUseBtn: { background: '#7c4dff', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', padding: '10px 20px', fontSize: 14, fontWeight: 600, letterSpacing: 1 },
  modalCloseBtn: { background: 'none', border: '1px solid #7c4dff40', borderRadius: 8, color: '#b39dff', cursor: 'pointer', padding: '8px 14px', fontSize: 16 },
  modalBody: { padding: 20, flex: 1, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 20, overflow: 'hidden', minHeight: 0 },
  modalSide: { display: 'flex', flexDirection: 'column', gap: 18, overflowY: 'auto', minHeight: 0, paddingRight: 4 },
  modalSection: {},
  modalSectionLabel: { fontSize: 11, color: '#8888aa', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  anchorWrap: { position: 'relative', cursor: 'zoom-in', borderRadius: 10, overflow: 'hidden', border: '1px solid #7c4dff30', background: '#111128', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 },
  anchorImg: { display: 'block', maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain', imageRendering: 'pixelated' },
  zoomHint: { position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.7)', color: '#b39dff', fontSize: 11, padding: '4px 10px', borderRadius: 4, pointerEvents: 'none' },
  modalDesc: { color: '#b8b8d4', fontSize: 13, lineHeight: 1.55, background: '#1a1a3a', padding: '10px 14px', borderRadius: 8, border: '1px solid #7c4dff20' },
  modalLoading: { color: '#7c7ca0', fontSize: 13, textAlign: 'center', padding: 20 },
  emptyHint: { color: '#7c7ca0', fontSize: 12, fontStyle: 'italic', padding: '8px 0' },
  layerStrip: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  layerThumb: { background: '#1a1a3a', border: '1px solid #7c4dff30', borderRadius: 6, padding: 4, cursor: 'zoom-in', textAlign: 'center', width: 70 },
  layerThumbImg: { width: 60, height: 60, objectFit: 'contain', imageRendering: 'pixelated', background: '#111' },
  layerThumbLabel: { fontSize: 9, color: '#b39dff', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  cycleStrip: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  cycleThumb: { background: '#1a1a3a', border: '1px solid #7c4dff30', borderRadius: 6, padding: 4, textAlign: 'center', width: 80 },
  cycleThumbImg: { width: 70, height: 70, objectFit: 'contain', imageRendering: 'pixelated', background: '#111', cursor: 'zoom-in', display: 'block' },
  cycleThumbLabel: { fontSize: 10, color: '#b39dff', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Zoom overlay (image lightbox)
  // For pixel art: scale up to a large display size with nearest-neighbor so 128px GIFs become viewable.
  // width: auto + height: min(...) lets browser scale based on aspect ratio while pixelated rendering preserves crispness.
  zoomBackdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.96)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, cursor: 'zoom-out', padding: 20 },
  zoomImg: { width: 'auto', height: 'auto', minWidth: 'min(80vw, 80vh)', minHeight: 'min(80vw, 80vh)', maxWidth: '95vw', maxHeight: '90vh', objectFit: 'contain', imageRendering: 'pixelated' },
  zoomCloseHint: { position: 'absolute', bottom: 16, color: '#7c7ca0', fontSize: 12, letterSpacing: 1 },
};
