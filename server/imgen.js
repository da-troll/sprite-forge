/**
 * Image generation via gpt-image-2 with reference-image support.
 *
 * - No refs: POST /v1/images/generations
 * - Refs:    POST /v1/images/edits  (up to 16 image[] entries, input_fidelity controls anchoring)
 *
 * Falls back to gpt-image-1 on 404.
 */
import OpenAI, { toFile } from 'openai';
import { OPENAI_IMAGE_KEY, IMAGE_MODEL } from './config.js';
import { promises as fsp, writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const client = new OpenAI({ apiKey: OPENAI_IMAGE_KEY });

// Cached after a successful call. Reset to IMAGE_MODEL so each cold-start tries gpt-image-2 first.
let resolvedModel = IMAGE_MODEL;
let modelLockReason = null;

async function refsToFiles(refPaths) {
  return Promise.all(refPaths.map(async (p, i) => {
    const buf = await fsp.readFile(p);
    const ext = (path.extname(p).slice(1) || 'png').toLowerCase();
    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    return toFile(buf, `ref_${i}.${ext}`, { type: mime });
  }));
}

async function callImageAPI({ prompt, refs, size, quality, inputFidelity, model }) {
  if (refs && refs.length > 0) {
    const images = await refsToFiles(refs);
    const editParams = {
      model,
      image: images,
      prompt,
      n: 1,
      size,
      quality,
    };
    // input_fidelity is only supported on gpt-image-1 / gpt-image-1.5; gpt-image-2 rejects it.
    if (model !== 'gpt-image-2' && inputFidelity) {
      editParams.input_fidelity = inputFidelity;
    }
    return client.images.edit(editParams);
  }
  return client.images.generate({
    model,
    prompt,
    n: 1,
    size,
    quality,
  });
}

/**
 * @param {object} opts
 * @param {string} opts.prompt
 * @param {string[]} [opts.refs] - absolute paths of reference images (uses edit endpoint)
 * @param {'low'|'high'} [opts.inputFidelity] - default 'high' when refs present
 * @param {string} [opts.size]
 * @param {string} [opts.quality]
 * @param {string} [opts.outputPath]
 */
export async function generateImage({
  prompt,
  refs = [],
  inputFidelity = 'high',
  size = '1024x1024',
  quality = 'medium',
  outputPath,
}) {
  const hasRefs = refs && refs.length > 0;
  let resp;
  try {
    resp = await callImageAPI({ prompt, refs, size, quality, inputFidelity, model: resolvedModel });
  } catch (err) {
    if ((err.status === 404 || err.status === 400) && resolvedModel === 'gpt-image-2') {
      console.warn('[imgen] gpt-image-2 failed, falling back to gpt-image-1:', err.message);
      resolvedModel = 'gpt-image-1';
      modelLockReason = err.message;
      resp = await callImageAPI({ prompt, refs, size, quality, inputFidelity, model: resolvedModel });
    } else {
      throw err;
    }
  }

  const b64 = resp.data[0].b64_json;
  const buf = Buffer.from(b64, 'base64');

  if (outputPath) {
    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, buf);
  }

  return { buffer: buf, b64, model: resolvedModel, usedRefs: hasRefs };
}
