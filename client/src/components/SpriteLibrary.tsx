import React, { useState } from 'react';
import type { Sprite } from '../App';

export default function SpriteLibrary({
  sprites, onSelect, onRefresh,
}: {
  sprites: Sprite[];
  onSelect: (s: Sprite) => void;
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = sprites.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.description?.toLowerCase().includes(search.toLowerCase())
  );

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
            <div key={s.id} style={S.card} onClick={() => onSelect(s)}>
              <div style={S.imgWrap}>
                {s.anchorUrl ? (
                  <img src={s.anchorUrl} alt={s.name} style={S.img} />
                ) : (
                  <div style={S.imgPlaceholder}>🎮</div>
                )}
              </div>
              <div style={S.cardBody}>
                <div style={S.cardName}>{s.name}</div>
                <div style={S.cardStyle}>{s.style_preset}</div>
                {(s as any).cycleCount > 0 && (
                  <div style={S.cardCycles}>🎬 {(s as any).cycleCount} cycles</div>
                )}
                <div style={S.cardDesc}>{s.description?.slice(0, 80)}...</div>
              </div>
              <div style={S.cardFooter}>
                <button style={S.selectBtn} onClick={() => onSelect(s)}>Open →</button>
              </div>
            </div>
          ))}
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
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 },
  card: { background: '#1a1a3a', border: '1px solid #7c4dff30', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', flexDirection: 'column' },
  imgWrap: { height: 160, background: '#111128', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  img: { width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' },
  imgPlaceholder: { fontSize: 48 },
  cardBody: { padding: '12px 14px', flex: 1 },
  cardName: { fontSize: 15, fontWeight: 600, color: '#e0e0ff', marginBottom: 4 },
  cardStyle: { fontSize: 11, color: '#7c4dff', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  cardCycles: { fontSize: 11, color: '#4caf50', marginBottom: 6 },
  cardDesc: { fontSize: 12, color: '#8888aa', lineHeight: 1.4 },
  cardFooter: { padding: '8px 14px', borderTop: '1px solid #7c4dff20' },
  selectBtn: { background: 'none', border: '1px solid #7c4dff40', borderRadius: 6, color: '#b39dff', cursor: 'pointer', padding: '6px 14px', fontSize: 13, width: '100%' },
};
