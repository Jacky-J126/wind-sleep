import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NCM_BASE = process.env.NCM_BASE || 'http://localhost:3000';
const COOKIE_PATH = path.join(__dirname, '..', 'user', 'ncm-cookie.txt');

// 读取登录后的网易云 cookie（含 MUSIC_U），用于获取付费/VIP 歌曲的播放地址
function loadCookie() {
  try {
    return fs.readFileSync(COOKIE_PATH, 'utf-8').trim();
  } catch {
    return '';
  }
}

function hasLogin() {
  return loadCookie().length > 0;
}

async function ncmRequest(endpoint) {
  try {
    const res = await fetch(`${NCM_BASE}${endpoint}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch {
    return null;
  }
}

async function search(keyword, limit = 5) {
  const data = await ncmRequest(`/search?keywords=${encodeURIComponent(keyword)}&limit=${limit}`);
  if (!data?.result?.songs) return [];
  return data.result.songs.map((s) => ({
    id: String(s.id),
    name: s.name,
    artist: (s.artists || []).map((a) => a.name).join(', '),
    album: s.album?.name || '',
  }));
}

async function songUrl(id) {
  const cookie = loadCookie();
  const cookieParam = cookie ? `&cookie=${encodeURIComponent(cookie)}` : '';
  const data = await ncmRequest(`/song/url?id=${id}${cookieParam}`);
  if (!data?.data?.[0]?.url) return null;
  return data.data[0].url;
}

async function lyric(id) {
  const data = await ncmRequest(`/lyric?id=${id}`);
  if (!data?.lrc?.lyric) return '';
  return data.lrc.lyric;
}

async function recommend() {
  const data = await ncmRequest('/personalized/newsong');
  if (!data?.result) return [];
  return data.result.map((s) => ({
    id: String(s.id),
    name: s.name,
    artist: (s.song?.artists || s.artists || []).map((a) => a.name || a).join(', '),
    album: s.song?.album?.name || s.album?.name || '',
  }));
}

// 轻量健康检查（/login/status 无需登录即可返回 JSON）
async function ping() {
  try {
    const res = await fetch(`${NCM_BASE}/login/status`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

export { search, songUrl, lyric, recommend, hasLogin, ping };
