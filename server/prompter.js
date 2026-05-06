/**
 * Prompt construction for all generation passes.
 * Uses gpt-4o-mini to expand user descriptions into tight image-gen prompts.
 */
import OpenAI from 'openai';
import { OPENAI_CHAT_KEY, CHAT_MODEL } from './config.js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REFS_DIR = path.join(__dirname, 'prompt-refs');

const client = new OpenAI({ apiKey: OPENAI_CHAT_KEY });

const STYLE_PRESETS = {
  '16bit-jrpg': {
    fragment: '16-bit JRPG sprite style, Super Nintendo SNES, vibrant colors, detailed pixel art, smooth character design',
    palette: 'gba',
    cycleDefaults: { frameCount: 8, fps: 8 },
  },
  'gba-pokemon': {
    fragment: 'Game Boy Advance Pokémon style sprite, small chibi proportions, clean pixel art, limited palette, bold outlines',
    palette: 'gba',
    cycleDefaults: { frameCount: 4, fps: 6 },
  },
  'cel-shaded-anime': {
    fragment: 'cel-shaded anime sprite, clean outlines, flat color fills, expressive design, Guilty Gear style',
    palette: 'custom',
    cycleDefaults: { frameCount: 8, fps: 10 },
  },
  'chibi': {
    fragment: 'super-deformed chibi sprite, large head small body ratio 1:2, pastel colors, round cute design',
    palette: 'custom',
    cycleDefaults: { frameCount: 6, fps: 8 },
  },
  'vampire-survivors': {
    fragment: 'Vampire Survivors style sprite, simple pixel art, top-down perspective ready, clear silhouette, bold design',
    palette: 'pico-8',
    cycleDefaults: { frameCount: 4, fps: 8 },
  },
  'cyberpunk-pixel': {
    fragment: 'cyberpunk pixel art sprite, neon colors on dark, tech augmentations, urban street style',
    palette: 'custom',
    cycleDefaults: { frameCount: 8, fps: 10 },
  },
  'ghibli': {
    fragment: 'Studio Ghibli inspired character sprite, painterly soft palette, whimsical design, expressive face',
    palette: 'custom',
    cycleDefaults: { frameCount: 8, fps: 8 },
  },
  'nes': {
    fragment: 'NES Nintendo style sprite, 8-bit pixel art, sharp pixels, limited color palette, classic game aesthetic',
    palette: 'nes',
    cycleDefaults: { frameCount: 4, fps: 6 },
  },
};

export function getStylePreset(name) {
  return STYLE_PRESETS[name] || STYLE_PRESETS['16bit-jrpg'];
}

export function listStylePresets() {
  return Object.keys(STYLE_PRESETS);
}

async function expandPrompt(userDesc, context) {
  const resp = await client.chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      {
        role: 'system',
        content: `You are a game art prompt engineer. Expand user descriptions into precise, concrete image generation prompts for pixel art sprites.
Rules:
- Always specify: transparent background, single character only, no background elements
- Include style, proportions, colors, distinctive features
- Keep under 120 words
- Output ONLY the prompt text, no commentary`,
      },
      { role: 'user', content: `Expand this for a ${context.style} sprite: "${userDesc}"` },
    ],
    max_tokens: 200,
  });
  return resp.choices[0].message.content.trim();
}

export async function buildAnchorPrompt(description, stylePreset) {
  const preset = getStylePreset(stylePreset);
  const expanded = await expandPrompt(description, { style: stylePreset });
  return `4-angle character reference sheet, ${preset.fragment}.
Four views arranged in 2x2 grid: top-left=front facing, top-right=three-quarter turn, bottom-left=side profile, bottom-right=back view.
Character: ${expanded}
Transparent background. White border between quadrants. Consistent design across all 4 angles. No text labels.`;
}

export async function buildLayerPrompt(description, layerType, stylePreset, anchorContext) {
  const preset = getStylePreset(stylePreset);
  const layerDescs = {
    base: 'naked mannequin base character body, no clothing, just the base figure',
    clothing: 'clothing outfit layer only, transparent everywhere except clothing',
    accessory: 'accessories only (hat, glasses, jewelry), transparent everywhere else',
    weapon: 'weapon or tool held in hand, isolated on transparent background',
    prop: 'environmental prop or item, no character, transparent background',
  };
  return `Isolated ${layerType} layer for sprite paper-doll system. ${preset.fragment}.
Layer type: ${layerDescs[layerType] || layerType}.
Character context: ${description}
Anchor design: ${anchorContext}
CRITICAL: Transparent PNG, only the ${layerType} visible, nothing else. Same perspective as anchor front view.`;
}

export async function buildCyclePrompt(description, cycleName, frameIndex, totalFrames, stylePreset) {
  const preset = getStylePreset(stylePreset);
  const cycleDescs = {
    walk: `walking cycle frame ${frameIndex+1}/${totalFrames}, legs in motion, arm swing`,
    run: `running cycle frame ${frameIndex+1}/${totalFrames}, dynamic lean, fast leg movement`,
    idle: `idle breathing animation frame ${frameIndex+1}/${totalFrames}, subtle body sway`,
    attack: `attack animation frame ${frameIndex+1}/${totalFrames}, weapon or fist forward`,
    hurt: `hurt reaction frame ${frameIndex+1}/${totalFrames}, recoil backwards, pained expression`,
    jump: `jump arc frame ${frameIndex+1}/${totalFrames}, airborne pose`,
    cast: `spell casting frame ${frameIndex+1}/${totalFrames}, magical gesture, energy particles`,
    death: `death animation frame ${frameIndex+1}/${totalFrames}, falling or collapsing`,
  };
  return `Single animation frame sprite. ${preset.fragment}.
Character: ${description}
Animation: ${cycleDescs[cycleName] || cycleName}
Transparent background. Consistent character design. Same proportions as reference.`;
}

export async function buildBackgroundPrompt(description, sceneStyle) {
  return `2D game environment background for sprite scene.
Sprites to feature: ${description}
Style: ${sceneStyle || 'pixel art game environment'}, side-scrolling perspective or isometric.
Atmospheric, detailed background. No characters. Suitable for sprite overlay compositing.
1024x1024 composition.`;
}
