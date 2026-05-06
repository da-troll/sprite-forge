import React, { useState, useEffect } from 'react';
import GeneratePanel from './components/GeneratePanel';
import SpriteLibrary from './components/SpriteLibrary';
import CycleLibrary from './components/CycleLibrary';
import PalettePanel from './components/PalettePanel';
import DepthMapsPanel from './components/DepthMapsPanel';
import SandboxCanvas from './components/SandboxCanvas';
import SceneCompositor from './components/SceneCompositor';
import { listSprites, getSprite } from './api';

export type Sprite = {
  id: string;
  name: string;
  description: string;
  style_preset: string;
  anchorUrl: string;
  cycles?: Cycle[];
  layers?: Layer[];
};

export type Cycle = {
  id: string;
  cycle_name: string;
  frames: { url: string; index: number; score?: number; pass?: boolean }[];
  sheetUrl: string;
  gifUrl: string;
  frame_count: number;
  scoringResults: { frameIndex: number; score: number | null; pass: boolean }[];
};

export type Layer = {
  id: string;
  layer_type: string;
  label: string;
  url: string;
};

type Tab = 'forge' | 'library' | 'cycles' | 'palette' | 'depth' | 'sandbox' | 'scene';

export default function App() {
  const [tab, setTab] = useState<Tab>('forge');
  const [sprites, setSprites] = useState<Sprite[]>([]);
  const [activeSprite, setActiveSprite] = useState<Sprite | null>(null);
  const [activeCycle, setActiveCycle] = useState<Cycle | null>(null);

  useEffect(() => {
    refreshSprites();
  }, []);

  async function refreshSprites() {
    const data = await listSprites();
    if (Array.isArray(data)) setSprites(data);
  }

  async function selectSprite(sprite: Sprite) {
    const full = await getSprite(sprite.id);
    setActiveSprite(full);
    setActiveCycle(full?.cycles?.[0] ?? null);
    setTab('cycles');
  }

  function onSpriteCreated(sprite: Sprite) {
    setActiveSprite(sprite);
    setTab('cycles');
    refreshSprites();
  }

  const TABS: { id: Tab; label: string; emoji: string }[] = [
    { id: 'forge', label: 'Forge', emoji: '⚔️' },
    { id: 'library', label: 'Library', emoji: '📚' },
    { id: 'cycles', label: 'Cycles', emoji: '🎬' },
    { id: 'palette', label: 'Palette', emoji: '🎨' },
    { id: 'depth', label: 'HD-2D Maps', emoji: '🗺️' },
    { id: 'sandbox', label: 'Sandbox', emoji: '🕹️' },
    { id: 'scene', label: 'Scene', emoji: '🎭' },
  ];

  return (
    <div style={styles.root}>
      <header style={styles.header}>
        <div style={styles.logo}>
          <span style={styles.logoEmoji}>🎮</span>
          <span style={styles.logoText}>SPRITE FORGE</span>
          <span style={styles.logoSub}>2D Character Pipeline</span>
        </div>
        {activeSprite && (
          <div style={styles.activeBadge}>
            <img src={activeSprite.anchorUrl} alt="" style={styles.activeBadgeImg} />
            <div>
              <div style={styles.activeBadgeName}>{activeSprite.name}</div>
              <div style={styles.activeBadgeStyle}>{activeSprite.style_preset}</div>
            </div>
          </div>
        )}
      </header>

      <nav style={styles.nav}>
        {TABS.map(t => (
          <button
            key={t.id}
            style={{ ...styles.navBtn, ...(tab === t.id ? styles.navBtnActive : {}) }}
            onClick={() => setTab(t.id)}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </nav>

      <main style={styles.main}>
        {tab === 'forge' && <GeneratePanel onCreated={onSpriteCreated} />}
        {tab === 'library' && <SpriteLibrary sprites={sprites} onSelect={selectSprite} onRefresh={refreshSprites} />}
        {tab === 'cycles' && activeSprite && (
          <CycleLibrary sprite={activeSprite} activeCycle={activeCycle} setActiveCycle={setActiveCycle} onRefresh={() => getSprite(activeSprite.id).then(s => { setActiveSprite(s); setActiveCycle(s?.cycles?.[0] ?? null); })} />
        )}
        {tab === 'palette' && activeSprite && <PalettePanel sprite={activeSprite} />}
        {tab === 'depth' && activeSprite && activeCycle && <DepthMapsPanel sprite={activeSprite} cycle={activeCycle} />}
        {tab === 'sandbox' && activeCycle && <SandboxCanvas cycle={activeCycle} />}
        {tab === 'scene' && <SceneCompositor sprites={sprites} />}

        {(tab === 'cycles' || tab === 'palette' || tab === 'depth' || tab === 'sandbox') && !activeSprite && (
          <div style={styles.noSprite}>
            <div style={{ fontSize: 48 }}>🎮</div>
            <div>No sprite selected. Head to <button style={styles.linkBtn} onClick={() => setTab('forge')}>Forge</button> to create one, or pick from <button style={styles.linkBtn} onClick={() => setTab('library')}>Library</button>.</div>
          </div>
        )}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0d0d1a' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', background: '#14143a', borderBottom: '1px solid #7c4dff40' },
  logo: { display: 'flex', alignItems: 'center', gap: 12 },
  logoEmoji: { fontSize: 28 },
  logoText: { fontSize: 22, fontWeight: 700, color: '#b39dff', letterSpacing: 3 },
  logoSub: { fontSize: 11, color: '#7c7ca0', letterSpacing: 2 },
  activeBadge: { display: 'flex', alignItems: 'center', gap: 10, background: '#1e1e44', padding: '6px 14px', borderRadius: 8, border: '1px solid #7c4dff40' },
  activeBadgeImg: { width: 40, height: 40, objectFit: 'cover', borderRadius: 4, imageRendering: 'pixelated' },
  activeBadgeName: { fontSize: 13, fontWeight: 600, color: '#e0e0ff' },
  activeBadgeStyle: { fontSize: 11, color: '#7c7ca0' },
  nav: { display: 'flex', gap: 2, padding: '0 16px', background: '#111130', borderBottom: '1px solid #7c4dff30', flexWrap: 'wrap' },
  navBtn: { padding: '10px 18px', background: 'none', border: 'none', color: '#8888aa', cursor: 'pointer', fontSize: 13, borderBottom: '2px solid transparent', transition: 'all 0.15s' },
  navBtnActive: { color: '#b39dff', borderBottom: '2px solid #7c4dff' },
  main: { flex: 1, padding: 24, maxWidth: 1400, width: '100%', margin: '0 auto' },
  noSprite: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 80, color: '#7c7ca0', textAlign: 'center', fontSize: 16 },
  linkBtn: { background: 'none', border: 'none', color: '#b39dff', cursor: 'pointer', textDecoration: 'underline', fontSize: 'inherit' },
};
