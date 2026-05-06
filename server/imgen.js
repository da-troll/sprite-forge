/**
 * Image generation via gpt-image-2.
 * Returns buffer + base64. Falls back to gpt-image-1 on 404.
 */
import OpenAI from 'openai';
import { OPENAI_IMAGE_KEY, IMAGE_MODEL } from './config.js';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const client = new OpenAI({ apiKey: OPENAI_IMAGE_KEY });

let resolvedModel = IMAGE_MODEL;

export async function generateImage({ prompt, size = '1024x1024', quality = 'medium', outputPath }) {
  let resp;
  try {
    resp = await client.images.generate({
      model: resolvedModel,
      prompt,
      n: 1,
      size,
      quality,
    });
  } catch (err) {
    if ((err.status === 404 || err.status === 400) && resolvedModel === 'gpt-image-2') {
      console.warn('[imgen] gpt-image-2 failed, falling back to gpt-image-1');
      resolvedModel = 'gpt-image-1';
      resp = await client.images.generate({
        model: resolvedModel,
        prompt,
        n: 1,
        size,
      });
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

  return { buffer: buf, b64, model: resolvedModel };
}

export async function editImage({ image, mask, prompt, size = '1024x1024', outputPath }) {
  const resp = await client.images.edit({
    model: resolvedModel,
    image,
    mask,
    prompt,
    n: 1,
    size,
  });

  const b64 = resp.data[0].b64_json;
  const buf = Buffer.from(b64, 'base64');

  if (outputPath) {
    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, buf);
  }

  return { buffer: buf, b64, model: resolvedModel };
}
