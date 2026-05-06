const BASE = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api`;

async function json(res: Response) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { error: text }; }
}

export async function generateAnchor(form: FormData) {
  const res = await fetch(`${BASE}/generate/anchor`, { method: 'POST', body: form });
  return json(res);
}

export async function generateLayers(spriteId: string, layerTypes: string[]) {
  const res = await fetch(`${BASE}/generate/layers`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spriteId, layerTypes }),
  });
  return json(res);
}

export type ImageQuality = 'low' | 'medium' | 'high' | 'auto';

export async function generateCycle(spriteId: string, cycleName: string, frameCount?: number, quality?: ImageQuality) {
  const res = await fetch(`${BASE}/generate/cycle`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spriteId, cycleName, frameCount, quality }),
  });
  return json(res);
}

export async function regenFrame(cycleId: string, frameIndex: number, quality?: ImageQuality) {
  const res = await fetch(`${BASE}/generate/regen-frame`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cycleId, frameIndex, quality }),
  });
  return json(res);
}

export async function listSprites() {
  return json(await fetch(`${BASE}/library`));
}

export async function getSprite(id: string) {
  return json(await fetch(`${BASE}/library/${id}`));
}

export async function remixSprite(id: string, stylePreset: string) {
  const res = await fetch(`${BASE}/library/${id}/remix`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stylePreset }),
  });
  return json(res);
}

export async function quantizePalette(spriteId: string, paletteName: string) {
  const res = await fetch(`${BASE}/palette/quantize`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spriteId, paletteName }),
  });
  return json(res);
}

export async function presetSwap(spriteId: string, presetName: string) {
  const res = await fetch(`${BASE}/palette/preset-swap`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spriteId, presetName }),
  });
  return json(res);
}

export async function buildDepthMaps(cycleId: string, frameIndex: number) {
  const res = await fetch(`${BASE}/depth/build`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cycleId, frameIndex }),
  });
  return json(res);
}

export async function buildBulkDepthMaps(cycleId: string) {
  const res = await fetch(`${BASE}/depth/bulk`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cycleId }),
  });
  return json(res);
}

export async function createScene(spriteIds: string[], sceneStyle?: string, name?: string) {
  const res = await fetch(`${BASE}/scene/create`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spriteIds, sceneStyle, name }),
  });
  return json(res);
}

export async function getSceneByToken(token: string) {
  return json(await fetch(`${BASE}/scene/share/${token}`));
}

export async function transcribeVoice(blob: Blob) {
  const form = new FormData();
  form.append('audio', blob, 'recording.webm');
  const res = await fetch(`${BASE}/voice/transcribe`, { method: 'POST', body: form });
  return json(res);
}

export async function getPresets() {
  return json(await fetch(`${BASE}/presets`));
}

export async function getPalettePresets() {
  return json(await fetch(`${BASE}/palette/presets`));
}
