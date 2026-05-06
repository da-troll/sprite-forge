/**
 * Voice input via Whisper-1
 * POST /api/voice/transcribe     — audio → text for prompt field
 */
import { Router } from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import { createReadStream, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { OPENAI_WHISPER_KEY } from '../config.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const client = new OpenAI({ apiKey: OPENAI_WHISPER_KEY });

router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'audio file required' });

    const ext = req.file.originalname?.split('.').pop() || 'webm';
    const tmpPath = path.join(tmpdir(), `sf_voice_${Date.now()}.${ext}`);
    writeFileSync(tmpPath, req.file.buffer);

    const resp = await client.audio.transcriptions.create({
      model: 'whisper-1',
      file: createReadStream(tmpPath),
      response_format: 'text',
    });

    res.json({ text: resp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
