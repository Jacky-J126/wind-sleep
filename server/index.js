import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import { init as initDb, getRecentPlays, getPlan, getRecentMessages } from './db.js';
import { route, saveTasteFile, handleNext } from './router.js';
import { init as initScheduler } from './scheduler.js';
import { start as startWeather } from './weather.js';
import { CACHE_DIR } from './tts.js';
import { songUrl, ping as pingNcm } from './ncm.js';
import { claudeAvailable } from './claude.js';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8888;
// 默认只监听本机；如需手机等局域网设备访问，设 HOST=0.0.0.0（服务无鉴权，详见 README 安全说明）
const HOST = process.env.HOST || '127.0.0.1';

// Init DB
initDb();

// Express app
const app = express();
app.use(express.json());

// 服务状态（/api/status 用，NCM 每 30s 探测一次）
const status = {
  hasFishKey: Boolean(process.env.FISH_AUDIO_KEY),
  claudeAvailable: claudeAvailable(),
  ncmUp: false,
  ncmCheckedAt: null,
};
async function refreshNcmStatus() {
  status.ncmUp = await pingNcm();
  status.ncmCheckedAt = new Date().toISOString();
}
refreshNcmStatus();
setInterval(refreshNcmStatus, 30 * 1000);

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

// GET /api/status — 依赖服务配置状态（前端设置页显示）
app.get('/api/status', (_req, res) => {
  res.json(status);
});

// GET /api/now
app.get('/api/now', (_req, res) => {
  const recent = getRecentPlays(1);
  res.json({ current: recent[0] || null });
});

// GET /api/next — 自动切歌候选（场景歌单/兜底关键词里挑一首可播的）
app.get('/api/next', async (_req, res) => {
  const plan = getPlan(new Date().toISOString().slice(0, 10));
  const next = await handleNext();
  res.json({ plan: plan ? plan.plan : null, next });
});

// GET /api/ncm/stream/:id — 同源 Range 音频代理（支持 seek，避免 CDN referer/过期问题）
app.get('/api/ncm/stream/:id', async (req, res) => {
  const url = await songUrl(req.params.id);
  if (!url) return res.status(404).json({ error: 'no playable url' });
  try {
    const headers = {};
    if (req.headers.range) headers.Range = req.headers.range;
    const upstream = await fetch(url, { headers });
    res.status(upstream.status);
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    }
    if (upstream.body) {
      Readable.fromWeb(upstream.body).pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    console.error('[stream] proxy error:', err.message);
    res.status(502).json({ error: 'stream proxy failed' });
  }
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
  // 版本化握手：客户端可据此判断协议兼容性
  ws.send(JSON.stringify({
    event: 'connected',
    data: { protocol: 'wind-sleep/1', time: new Date().toISOString() },
    ts: Date.now(),
  }));

  ws.on('close', () => {
    console.log('[ws] Client disconnected');
  });
});

// 统一事件信封 { event, data, ts }
function broadcast(event, data) {
  const payload = JSON.stringify({ event, data, ts: Date.now() });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(payload);
  });
}

// Init scheduler with broadcast
initScheduler(broadcast);

// Start weather updater (background refresh, cached)
startWeather();

server.listen(PORT, HOST, () => {
  console.log(`\n  🌬️  Wind Sleep is awake`);
  console.log(`  ─────────────────────────`);
  console.log(`  Server:  http://${HOST}:${PORT}`);
  console.log(`  Stream:  ws://${HOST}:${PORT}/stream`);
  console.log(`  ─────────────────────────\n`);
});
