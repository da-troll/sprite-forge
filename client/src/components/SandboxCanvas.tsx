import React, { useEffect, useRef, useState } from 'react';
import type { Cycle } from '../App';

const FRAME_SIZE = 128;
const DISPLAY_SCALE = 3;
const CANVAS_W = 800;
const CANVAS_H = 480;
const GRAVITY = 0.6;
const JUMP_VEL = -14;
const WALK_SPEED = 3;
const RUN_SPEED = 6;

interface SpriteState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  facing: 1 | -1;
  anim: 'idle' | 'walk' | 'run' | 'jump';
  frameIndex: number;
  frameTimer: number;
}

export default function SandboxCanvas({ cycle }: { cycle: Cycle }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<SpriteState>({
    x: CANVAS_W / 2, y: CANVAS_H - 100 - FRAME_SIZE * DISPLAY_SCALE / 2,
    vx: 0, vy: 0, onGround: true, facing: 1,
    anim: 'idle', frameIndex: 0, frameTimer: 0,
  });
  const keysRef = useRef<Set<string>>(new Set());
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const rafRef = useRef<number>(0);
  const [shareUrl] = useState(() => `${window.location.origin}/sandbox-share?cycle=${cycle.id}`);
  const [copied, setCopied] = useState(false);

  // Preload all frame images
  useEffect(() => {
    const loaded: Promise<void>[] = [];
    cycle.frames.forEach((f, i) => {
      const img = new Image();
      const p = new Promise<void>(resolve => { img.onload = () => resolve(); img.onerror = () => resolve(); });
      img.src = f.url;
      imagesRef.current.set(String(i), img);
      loaded.push(p);
    });
    return () => {};
  }, [cycle]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    const onKey = (e: KeyboardEvent, down: boolean) => {
      keysRef.current[down ? 'add' : 'delete'](e.code);
      e.preventDefault();
    };
    window.addEventListener('keydown', e => onKey(e, true));
    window.addEventListener('keyup', e => onKey(e, false));

    const FPS_STEP = 1000 / 60;
    let last = 0;

    const FLOOR_Y = CANVAS_H - 80;
    const SPRITE_H = FRAME_SIZE * DISPLAY_SCALE;
    const SPRITE_W = FRAME_SIZE * DISPLAY_SCALE;

    function update() {
      const s = stateRef.current;
      const keys = keysRef.current;
      const shift = keys.has('ShiftLeft') || keys.has('ShiftRight');

      const speed = shift ? RUN_SPEED : WALK_SPEED;
      s.vx = 0;

      if (keys.has('ArrowLeft') || keys.has('KeyA')) { s.vx = -speed; s.facing = -1; }
      if (keys.has('ArrowRight') || keys.has('KeyD')) { s.vx = speed; s.facing = 1; }
      if ((keys.has('ArrowUp') || keys.has('KeyW') || keys.has('Space')) && s.onGround) {
        s.vy = JUMP_VEL; s.onGround = false;
      }

      s.vy += GRAVITY;
      s.x += s.vx;
      s.y += s.vy;

      // Floor collision
      if (s.y + SPRITE_H / 2 >= FLOOR_Y) {
        s.y = FLOOR_Y - SPRITE_H / 2;
        s.vy = 0;
        s.onGround = true;
      }

      // Wall wrap
      if (s.x < 0) s.x = CANVAS_W;
      if (s.x > CANVAS_W) s.x = 0;

      // Determine animation
      if (!s.onGround) s.anim = 'jump';
      else if (s.vx !== 0) s.anim = shift ? 'run' : 'walk';
      else s.anim = 'idle';

      const fps = s.anim === 'run' ? 10 : s.anim === 'walk' ? 8 : 4;
      s.frameTimer++;
      if (s.frameTimer >= Math.floor(60 / fps)) {
        s.frameTimer = 0;
        s.frameIndex = (s.frameIndex + 1) % cycle.frames.length;
      }
    }

    function draw() {
      const s = stateRef.current;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // Background: dungeon-ish
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Pixel grid hint
      ctx.fillStyle = '#7c4dff08';
      for (let x = 0; x < CANVAS_W; x += 32) ctx.fillRect(x, 0, 1, CANVAS_H);
      for (let y = 0; y < CANVAS_H; y += 32) ctx.fillRect(0, y, CANVAS_W, 1);

      // Floor
      ctx.fillStyle = '#2d1b69';
      ctx.fillRect(0, FLOOR_Y, CANVAS_W, CANVAS_H - FLOOR_Y);
      ctx.fillStyle = '#7c4dff';
      ctx.fillRect(0, FLOOR_Y, CANVAS_W, 2);

      // Floor tiles
      ctx.fillStyle = '#3d2b79';
      for (let x = 0; x < CANVAS_W; x += 64) {
        ctx.fillRect(x, FLOOR_Y, 2, CANVAS_H - FLOOR_Y);
      }

      // Sprite
      const img = imagesRef.current.get(String(s.frameIndex));
      if (img) {
        ctx.save();
        ctx.translate(Math.round(s.x), Math.round(s.y - SPRITE_H / 2));
        if (s.facing === -1) {
          ctx.scale(-1, 1);
          ctx.translate(-SPRITE_W, 0);
        }
        ctx.drawImage(img, 0, 0, FRAME_SIZE, FRAME_SIZE, 0, 0, SPRITE_W, SPRITE_H);
        ctx.restore();
      }

      // Shadow
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(s.x, FLOOR_Y + 4, SPRITE_W * 0.3, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Controls hint
      ctx.fillStyle = '#7c4dff60';
      ctx.font = '12px monospace';
      ctx.fillText('WASD / Arrow Keys to move  |  Shift to run  |  Space to jump', 16, CANVAS_H - 16);
    }

    function loop(ts: number) {
      if (ts - last >= FPS_STEP) {
        update();
        draw();
        last = ts;
      }
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('keydown', e => onKey(e, true));
      window.removeEventListener('keyup', e => onKey(e, false));
    };
  }, [cycle]);

  function copyShare() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={S.root}>
      <h2 style={S.title}>🕹️ WASD Sandbox</h2>
      <p style={S.sub}>Click the canvas to focus, then use WASD / Arrow Keys to move. Shift to run, Space/W to jump.</p>

      <div style={S.canvasWrap}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={S.canvas}
          tabIndex={0}
        />
      </div>

      <div style={S.shareRow}>
        <div style={S.shareLabel}>🔗 Share this sandbox:</div>
        <input style={S.shareInput} value={shareUrl} readOnly onClick={e => (e.target as HTMLInputElement).select()} />
        <button style={S.copyBtn} onClick={copyShare}>
          {copied ? '✅ Copied!' : '📋 Copy Link'}
        </button>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  root: {},
  title: { fontSize: 22, color: '#b39dff', marginBottom: 8 },
  sub: { color: '#8888aa', fontSize: 13, marginBottom: 16 },
  canvasWrap: { border: '2px solid #7c4dff40', borderRadius: 8, overflow: 'hidden', display: 'inline-block' },
  canvas: { display: 'block', cursor: 'crosshair', imageRendering: 'pixelated' },
  shareRow: { marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 },
  shareLabel: { fontSize: 13, color: '#8888aa', whiteSpace: 'nowrap' },
  shareInput: { flex: 1, background: '#1a1a3a', border: '1px solid #7c4dff40', borderRadius: 6, color: '#b39dff', padding: '8px 12px', fontSize: 13, outline: 'none' },
  copyBtn: { background: '#7c4dff40', border: '1px solid #7c4dff', borderRadius: 6, color: '#b39dff', cursor: 'pointer', padding: '8px 16px', fontSize: 13, whiteSpace: 'nowrap' },
};
