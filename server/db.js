import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.WS_STATE_PATH || path.join(__dirname, '..', 'state.json');

let state = { messages: [], plays: [], plans: {}, prefix: {} };

function load() {
  try {
    if (fs.existsSync(DB_PATH)) {
      state = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    }
  } catch (err) {
    console.error('[db] Failed to load state, starting fresh:', err.message);
    state = { messages: [], plays: [], plans: {}, prefix: {} };
  }
  // Ensure all keys exist (migration-safe)
  state.messages = state.messages || [];
  state.plays = state.plays || [];
  state.plans = state.plans || {};
  state.prefix = state.prefix || {};
}

function save() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('[db] Failed to save state:', err.message);
  }
}

let idCounter = Date.now();

function nextId() {
  return String(++idCounter);
}

// Called once at startup
function init() {
  load();
  // Restore idCounter from existing data
  const allIds = [
    ...state.messages.map((m) => Number(m.id)),
    ...state.plays.map((p) => Number(p.id)),
  ].filter(Boolean);
  if (allIds.length > 0) {
    idCounter = Math.max(...allIds);
  }
  console.log(`[db] State loaded: ${state.messages.length} messages, ${state.plays.length} plays`);
  return state;
}

function logMessage(role, content, meta = null) {
  const entry = {
    id: nextId(),
    role,
    content,
    meta: meta ? JSON.stringify(meta) : null,
    created_at: new Date().toISOString(),
  };
  state.messages.push(entry);
  save();
  return entry;
}

function getRecentMessages(limit = 20) {
  return state.messages.slice(-limit);
}

function logPlay({ song_id, song_name, artist, reason, segue, url }) {
  const entry = {
    id: nextId(),
    song_id: song_id || null,
    song_name: song_name || null,
    artist: artist || null,
    reason: reason || null,
    segue: segue || null,
    url: url || null,
    played_at: new Date().toISOString(),
  };
  state.plays.push(entry);
  save();
  return entry;
}

function getRecentPlays(limit = 10) {
  return state.plays.slice(-limit).reverse();
}

function getPlan(date) {
  const plan = state.plans[date];
  if (!plan) return null;
  let parsed = null;
  try { parsed = typeof plan.content === 'string' ? JSON.parse(plan.content) : plan.content; } catch { parsed = null; }
  return { date, content: plan.content, plan: parsed, created_at: plan.created_at };
}

function setPlan(date, content) {
  state.plans[date] = { content, created_at: new Date().toISOString() };
  save();
}

function getPrefix(key) {
  return state.prefix[key] || null;
}

function setPrefix(key, value) {
  state.prefix[key] = value;
  save();
}

export { init, load, save, logMessage, getRecentMessages, logPlay, getRecentPlays, getPlan, setPlan, getPrefix, setPrefix };
