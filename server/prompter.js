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

/**
 * Vision-enrich: have gpt-4o-mini describe the reference image's identity-preserving
 * features (face, hair, build, distinctive attire) so the text prompt + image refs both
 * carry the same identity signal.
 */
import { promises as fsp } from 'fs';
export async function describeReference(refImagePath) {
  try {
    const buf = await fsp.readFile(refImagePath);
    const b64 = buf.toString('base64');
    const ext = (refImagePath.split('.').pop() || 'png').toLowerCase();
    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    const resp = await client.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        {
          role: 'system',
          content: `You describe characters from reference images for sprite-art generation.
Extract identity-preserving features ONLY:
- face shape, skin tone, distinctive features
- hair colour, length, style
- eye colour
- body type / build / approximate height
- signature outfit elements (jacket, hat, weapon, jewelry)
- pose if relevant
Output a tight comma-separated description in 25-50 words. No commentary.`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this character for a sprite reference:' },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
          ],
        },
      ],
      max_tokens: 200,
    });
    return resp.choices[0].message.content.trim();
  } catch (err) {
    console.warn('[describeReference] failed:', err.message);
    return null;
  }
}

/**
 * Anchor prompt — invoked with `images.edit` when refs are provided.
 * - refRoles[i] describes the role of refs[i] ('primary identity' | 'pose' | 'style')
 */
export async function buildAnchorPrompt(description, stylePreset, refRoles = []) {
  const preset = getStylePreset(stylePreset);
  const expanded = await expandPrompt(description, { style: stylePreset });

  const refSection = refRoles.length > 0
    ? `\nREFERENCES (preserve identity from these images):
${refRoles.map((role, i) => `- Image ${i + 1} (${role}): retain face, hair colour, eye colour, build, distinctive features.`).join('\n')}\n`
    : '';

  return `TASK: 4-angle character reference sheet for a game sprite.
LAYOUT: 2×2 grid — top-left=front, top-right=three-quarter turn, bottom-left=side profile, bottom-right=back.
${refSection}
STYLE: ${preset.fragment}.
CHARACTER: ${expanded}
INVARIANTS: identical character across all four angles. Transparent background. White borders between quadrants. No text labels. Consistent proportions and colour palette.`;
}

/**
 * Layer prompt — always invoked with `images.edit` against the anchor sheet.
 * Anchor is the primary visual reference; the prompt isolates one paper-doll layer.
 */
export function buildLayerPrompt(description, layerType, stylePreset) {
  const preset = getStylePreset(stylePreset);
  const layerDescs = {
    base: 'naked mannequin base body — no clothing, no accessories, just the bare figure',
    clothing: 'clothing outfit only — full body garments as worn, transparent everywhere else',
    accessory: 'accessories only — hat, glasses, jewelry, belt — transparent everywhere else',
    weapon: 'weapon or held tool only — extracted from the character, transparent everywhere else',
    prop: 'environmental prop or held item only — no character, transparent background',
  };

  return `TASK: extract a single paper-doll layer for the character shown in the reference image.
OUTPUT FORMAT: a single isolated ${layerType} centered on a transparent canvas. NOT a multi-angle sheet, NOT a 2x2 grid, NOT multiple views.
LAYER: ${layerType} — ${layerDescs[layerType] || layerType}.
STYLE: ${preset.fragment}.
CHARACTER: ${description}
INVARIANTS: same colours, proportions, and design as the reference. Output ONLY the ${layerType} — every other element (background, body, other clothing) must be fully transparent.`;
}

/**
 * Cycle frame prompt — always invoked with `images.edit` against the anchor sheet.
 * The anchor is the canonical identity; the prompt requests one animation pose.
 */
export function buildCyclePrompt(description, cycleName, frameIndex, totalFrames, stylePreset) {
  const preset = getStylePreset(stylePreset);
  const cycleDescs = {
    walk: `walking cycle frame ${frameIndex + 1}/${totalFrames} — legs mid-stride, opposite arm forward, weight shift`,
    run: `running cycle frame ${frameIndex + 1}/${totalFrames} — dynamic lean, fast leg movement, exaggerated motion`,
    idle: `idle breathing animation frame ${frameIndex + 1}/${totalFrames} — subtle body sway, micro-motion`,
    attack: `attack animation frame ${frameIndex + 1}/${totalFrames} — weapon or fist forward, anticipation/strike/recovery beat`,
    hurt: `hurt reaction frame ${frameIndex + 1}/${totalFrames} — recoil backwards, pained expression`,
    jump: `jump arc frame ${frameIndex + 1}/${totalFrames} — airborne pose, limbs tucked or spread`,
    cast: `spell casting frame ${frameIndex + 1}/${totalFrames} — magical gesture, energy particles emerging`,
    death: `death animation frame ${frameIndex + 1}/${totalFrames} — falling, collapsing, or dissolving pose`,
  };

  return `TASK: produce ONE single full-body animation frame of the character shown in the reference image.
OUTPUT FORMAT: a single character pose centered in the canvas, full body visible, transparent background.
DO NOT: do not produce a multi-angle reference sheet. Do not produce a 2x2 grid. Do not show multiple poses or views. Do not duplicate the character. Just one pose.
ANIMATION POSE: ${cycleDescs[cycleName] || cycleName}.
STYLE: ${preset.fragment}.
CHARACTER: ${description}
INVARIANTS: identical face, hair colour, outfit, weapon, and colour palette as the reference. Single full-body 3/4-view or front-facing pose. Transparent background.`;
}

export async function buildBackgroundPrompt(description, sceneStyle) {
  return `2D game environment background for sprite scene.
Sprites to feature: ${description}
Style: ${sceneStyle || 'pixel art game environment'}, side-scrolling perspective or isometric.
Atmospheric, detailed background. No characters. Suitable for sprite overlay compositing.
1024x1024 composition.`;
}
