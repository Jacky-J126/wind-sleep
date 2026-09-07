import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { init as initDb, getRecentPlays, getPlan, logMessage, getRecentMessages } from './db.js';
import { route, saveTasteFile } from './router.js';
import { init as initScheduler } from './scheduler.js';
import { start as startWeather } from './weather.js';
import { CACHE_DIR } from './tts.js';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8888;

// Init DB
initDb();

// Express app
const app = express();
app.use(express.json());

// Serve TTS cache
app.use('/tts', express.static(CACHE_DIR));

// Serve PWA static files (production)
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

// --- HTTP API ---

// POST /api/chat
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });
  const result = await route(message, { cwd: path.join(__dirname, '..'), broadcast });
  res.json(result);
});

// GET /api/now
app.get('/api/now', (_req, res) => {
  const recent = getRecentPlays(1);
  res.json({ current: recent[0] || null });
});

// GET /api/next
app.get('/api/next', (_req, res) => {
  const plan = getPlan(new Date().toISOString().slice(0, 10));
  res.json({ plan: plan ? plan.plan : null, next: null });
});

// GET /api/taste
app.get('/api/taste', (_req, res) => {
  const userDir = path.join(__dirname, '..', 'user');
  const files = {};
  for (const f of ['taste.md', 'routines.md', 'mood-rules.md', 'playlists.json']) {
    try { files[f] = fs.readFileSync(path.join(userDir, f), 'utf-8'); } catch { files[f] = ''; }
  }
  res.json(files);
});

// GET /api/plan/today
app.get('/api/plan/today', (_req, res) => {
  const plan = getPlan(new Date().toISOString().slice(0, 10));
  res.json({ plan: plan ? plan.plan : null });
});

// POST /api/taste — save a taste file
app.post('/api/taste', async (req, res) => {
  const { file, content } = req.body;
  if (!file || content === undefined) {
    return res.status(400).json({ error: 'file and content required' });
  }
  const result = saveTasteFile(file, content);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

// GET /api/history
app.get('/api/history', (_req, res) => {
  const messages = getRecentMessages(50);
  res.json({ messages });
});

// SPA fallback
app.get('*', (_req, res) => {
  const indexPath = path.join(clientDist, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send('Wind Sleep API running. Frontend not built yet.');
  }
});

// HTTP + WS server
const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: '/stream' });

wss.on('connection', (ws) => {
  console.log('[ws] Client connected');

  ws.on('close', () => {
    console.log('[ws] Client disconnected');
  });
});

function broadcast(data) {
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(payload);
  });
}

// Init scheduler with broadcast
initScheduler(broadcast);

// Start weather updater (background refresh, cached)
startWeather();

server.listen(PORT, () => {
  console.log(`\n  🌬️  Wind Sleep is awake`);
  console.log(`  ─────────────────────────`);
  console.log(`  Server:  http://localhost:${PORT}`);
  console.log(`  Stream:  ws://localhost:${PORT}/stream`);
  console.log(`  ─────────────────────────\n`);
});
