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
              <div style={S.modalSection}>
                <div style={S.modalSectionLabel}>📐 Anchor Sheet (4 angles)</div>
                <div style={S.anchorWrap} onClick={() => setZoomImg(modalSprite.anchorUrl)}>
                  <img src={modalSprite.anchorUrl} alt="anchor" style={S.anchorImg} />
                  <div style={S.zoomHint}>🔍 Click to zoom</div>
                </div>
              </div>

              {modalSprite.description && (
                <div style={S.modalSection}>
                  <div style={S.modalSectionLabel}>📝 Description</div>
                  <div style={S.modalDesc}>{modalSprite.description}</div>
                </div>
              )}

              {modalLoading ? (
                <div style={S.modalLoading}>⏳ Loading layers + cycles…</div>
              ) : (
                <>
                  {modalSprite.layers && modalSprite.layers.length > 0 && (
                    <div style={S.modalSection}>
                      <div style={S.modalSectionLabel}>🧩 Paper-Doll Layers ({modalSprite.layers.length})</div>
                      <div style={S.layerGrid}>
                        {modalSprite.layers.map((l: any) => (
                          <div key={l.id} style={S.layerCard} onClick={() => setZoomImg(l.url)}>
                            <img src={l.url} alt={l.layer_type} style={S.layerImg} />
                            <div style={S.layerLabel}>{l.layer_type}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {modalSprite.cycles && modalSprite.cycles.length > 0 && (
                    <div style={S.modalSection}>
                      <div style={S.modalSectionLabel}>🎬 Animation Cycles ({modalSprite.cycles.length})</div>
                      <div style={S.cycleGrid}>
                        {modalSprite.cycles.map((c: any) => (
                          <div key={c.id} style={S.cycleCard}>
                            <div style={S.cycleHead}>{c.cycle_name.toUpperCase()} <span style={S.cycleFrames}>· {c.frame_count} frames</span></div>
                            {c.gifUrl && (
                              <img
                                src={c.gifUrl}
                                alt={c.cycle_name}
                                style={S.cycleGif}
                                onClick={() => setZoomImg(c.gifUrl)}
                              />
                            )}
                            {c.sheetUrl && (
                              <a href={c.sheetUrl} target="_blank" rel="noreferrer" style={S.cycleSheet}>
                                Sprite sheet ↗
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
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
  modalBody: { padding: 24, overflowY: 'auto', flex: 1 },
  modalSection: { marginBottom: 28 },
  modalSectionLabel: { fontSize: 12, color: '#8888aa', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  anchorWrap: { position: 'relative', display: 'inline-block', cursor: 'zoom-in', borderRadius: 10, overflow: 'hidden', border: '1px solid #7c4dff30' },
  anchorImg: { display: 'block', maxWidth: '100%', maxHeight: 600, objectFit: 'contain', imageRendering: 'pixelated', background: '#111128' },
  zoomHint: { position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.7)', color: '#b39dff', fontSize: 11, padding: '4px 10px', borderRadius: 4 },
  modalDesc: { color: '#b8b8d4', fontSize: 14, lineHeight: 1.6, background: '#1a1a3a', padding: '12px 16px', borderRadius: 8, border: '1px solid #7c4dff20' },
  modalLoading: { color: '#7c7ca0', fontSize: 14, textAlign: 'center', padding: 40 },
  layerGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 },
  layerCard: { background: '#1a1a3a', border: '1px solid #7c4dff30', borderRadius: 8, padding: 8, cursor: 'zoom-in', textAlign: 'center' },
  layerImg: { width: '100%', height: 100, objectFit: 'contain', imageRendering: 'pixelated', background: '#111' },
  layerLabel: { fontSize: 11, color: '#b39dff', marginTop: 6, textTransform: 'uppercase', letterSpacing: 1 },
  cycleGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 },
  cycleCard: { background: '#1a1a3a', border: '1px solid #7c4dff30', borderRadius: 10, padding: 12 },
  cycleHead: { fontSize: 12, fontWeight: 700, color: '#b39dff', letterSpacing: 1, marginBottom: 8 },
  cycleFrames: { color: '#7c7ca0', fontWeight: 400 },
  cycleGif: { width: '100%', height: 120, objectFit: 'contain', imageRendering: 'pixelated', background: '#111', borderRadius: 6, cursor: 'zoom-in', display: 'block' },
  cycleSheet: { display: 'inline-block', marginTop: 8, fontSize: 11, color: '#7c4dff', textDecoration: 'none' },

  // Zoom overlay (image lightbox)
  zoomBackdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.96)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, cursor: 'zoom-out', padding: 20 },
  zoomImg: { maxWidth: '95vw', maxHeight: '90vh', objectFit: 'contain', imageRendering: 'pixelated' },
  zoomCloseHint: { position: 'absolute', bottom: 16, color: '#7c7ca0', fontSize: 12, letterSpacing: 1 },
};
