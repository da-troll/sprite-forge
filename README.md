# Sprite Forge 🎮

AI-powered 2D sprite pipeline for game developers.

**Live:** https://mvp.trollefsen.com/2026-05-06-sprite-forge/

Fork of [0x0funky/agent-sprite-forge](https://github.com/0x0funky/agent-sprite-forge) (MIT). Ripped Python local processors, added full web pipeline.

## Features

- **Anchor Sheet** — gpt-image-2 generates a 4-angle (front/3-quarter/side/back) high-res character reference
- **Paper-Doll Layers** — Base mannequin, clothing, accessories, weapons, props as separate transparent PNGs
- **Identity Scoring** — ViT/DINOv2 cosine similarity against anchor before accepting any frame; auto-regen below threshold
- **8 Cycles** — Walk, run, idle, attack, hurt, jump, cast, death with sprite sheet + GIF export
- **HD-2D Maps** — Depth Anything V2 depth map, Sobel-derived normal map, gpt-image-2 emission mask per frame
- **Palette Quantization** — K-means snap to PICO-8, NES, GBA, or custom palettes
- **Palette Swaps** — Player 2, Ice, Fire, Shadow Clone with one click
- **WASD Sandbox** — Shareable URL, sprite drops in immediately after first cycle
- **Scene Compositor** — Place 2-3 sprites on a gpt-image-2 generated background
- **Sprite Library** — Full history, remix any past sprite with a different style

## Stack

- React + TypeScript + Vite (frontend)
- Express + better-sqlite3 (backend)
- gpt-image-2 (all image generation)
- `@xenova/transformers` ViT-base (identity scoring)
- Depth Anything V2 ONNX (depth maps)
- Pillow/numpy (GIF assembly, inherited from upstream)
- Port 3479, pm2-managed
