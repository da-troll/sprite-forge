import { readFileSync } from 'fs';
import path from 'path';

const hh = JSON.parse(readFileSync('/home/eve/config/household.json', 'utf8'));

export const OPENAI_IMAGE_KEY = hh.skills.apiKeys.openai_image_gen;
export const OPENAI_CHAT_KEY = hh.skills.apiKeys.openai_chat;
export const OPENAI_WHISPER_KEY = hh.skills.apiKeys.openai_whisper;

export const IMAGE_MODEL = 'gpt-image-2';
export const CHAT_MODEL = 'gpt-4o-mini';

export const LIBRARY_DIR = '/home/eve/workspaces/shared/images/mvp/2026-05-06-sprite-forge/library';
export const MEDIA_BASE = 'https://mvp.trollefsen.com/media/mvp/2026-05-06-sprite-forge/library';

// 0.65 calibrated for pixel art (scores ~0.45-0.55 baseline). Bump to 0.78 for photoreal.
export const DINOV2_THRESHOLD = 0.65;
export const DINOV2_REGEN_MAX = 2;
export const TARGET_WPS = 3.4;

export const MODELS_DIR = '/home/eve/workspaces/shared/models';
