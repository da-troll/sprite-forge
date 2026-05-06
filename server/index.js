import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

import { LIBRARY_DIR } from './config.js';
import generateRoutes from './routes/generate.js';
import libraryRoutes from './routes/library.js';
import paletteRoutes from './routes/palette.js';
import depthRoutes from './routes/depth.js';
import sceneRoutes from './routes/scene.js';
import voiceRoutes from './routes/voice.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3479;

mkdirSync(LIBRARY_DIR, { recursive: true });
mkdirSync(path.join(__dirname, '../data'), { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// API routes
app.use('/api/generate', generateRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/palette', paletteRoutes);
app.use('/api/depth', depthRoutes);
app.use('/api/scene', sceneRoutes);
app.use('/api/voice', voiceRoutes);

import { listStylePresets } from './prompter.js';

// Style presets info
app.get('/api/presets', (req, res) => {
  res.json({ presets: listStylePresets() });
});

// Serve built client
const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[sprite-forge] Server running on port ${PORT}`);
});
