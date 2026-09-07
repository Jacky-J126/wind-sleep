import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, 'tts');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// TODO: Replace with real Fish Audio API key
const FISH_AUDIO_API_KEY = process.env.FISH_AUDIO_KEY || '';
const FISH_AUDIO_BASE = 'https://api.fish.audio/v1';

function hashText(text, voice) {
  return crypto.createHash('md5').update(`${voice}:${text}`).digest('hex');
}

function cachedPath(hash) {
  return path.join(CACHE_DIR, `${hash}.mp3`);
}

async function synthesize(text, { voice = 'default', force = false } = {}) {
  const hash = hashText(text, voice);
  const filePath = cachedPath(hash);

  // Return cached file if exists
  if (!force && fs.existsSync(filePath)) {
    return { url: `/tts/${hash}.mp3`, cached: true };
  }

  // If no API key, return mock (silence)
  if (!FISH_AUDIO_API_KEY) {
    // Write a minimal valid mp3 (silence) as placeholder
    if (!fs.existsSync(filePath)) {
      fs.copyFileSync(path.join(__dirname, '..', 'assets', 'silence.mp3'), filePath);
    }
    return { url: `/tts/${hash}.mp3`, cached: false, mock: true };
  }

  // Real Fish Audio API call
  try {
    const res = await fetch(`${FISH_AUDIO_BASE}/tts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FISH_AUDIO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, voice }),
    });
    if (!res.ok) throw new Error(`Fish Audio API error: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
    return { url: `/tts/${hash}.mp3`, cached: false };
  } catch (err) {
    console.error('TTS synthesis failed:', err.message);
    return { url: null, error: err.message };
  }
}

export { synthesize, CACHE_DIR };
