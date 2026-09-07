import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getRecentMessages, getRecentPlays, getPlan } from './db.js';
import { getCached as getWeather } from './weather.js';
import { askStructured } from './claude.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

function timeLabel(hour) {
  return hour < 6 ? '凌晨' : hour < 9 ? '早晨' : hour < 12 ? '上午' : hour < 14 ? '午后' : hour < 18 ? '下午' : hour < 21 ? '傍晚' : '深夜';
}

function buildSystemPrompt() {
  const promptMd = readFileSafe(path.join(__dirname, 'prompts', 'default.md'));

  const taste = readFileSafe(path.join(__dirname, '..', 'user', 'taste.md'));
  const routines = readFileSafe(path.join(__dirname, '..', 'user', 'routines.md'));
  const moodRules = readFileSafe(path.join(__dirname, '..', 'user', 'mood-rules.md'));

  const userCorpus = [taste, routines, moodRules].filter(Boolean).join('\n\n');
  const recentPlays = getRecentPlays(10);

  const today = new Date().toISOString().slice(0, 10);
  const plan = getPlan(today);

  // Execution trajectory: recent plays with time + reason + segue
  const playsList = recentPlays.length > 0
    ? recentPlays.map((p) => {
        const t = p.played_at ? new Date(p.played_at) : null;
        const time = t ? `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}` : '?';
        return `- [${time}] ${p.song_name || '?'} by ${p.artist || '?'}${p.reason ? ` — ${p.reason}` : ''}${p.segue ? ` (segue: ${p.segue})` : ''}`;
      }).join('\n')
    : 'No plays yet';

  // Scenario playlists from user/playlists.json
  let playlistLines = 'None';
  try {
    const playlists = JSON.parse(readFileSafe(path.join(__dirname, '..', 'user', 'playlists.json')) || '{}');
    const entries = Object.entries(playlists);
    if (entries.length > 0) {
      playlistLines = entries.map(([scene, keywords]) => `- ${scene}: ${(keywords || []).join(' / ')}`).join('\n');
    }
  } catch {}

  const now = new Date();
  const hour = now.getHours();
  const weather = getWeather();
  const weatherLine = weather
    ? `${weather.desc}，${weather.tempC}°C，湿度 ${weather.humidity}%，${weather.location}`
    : '未知';

  // 六片式 Prompt 组装（对齐 spec）：
  // 系统提示 / 品味语料 / 环境注入 / 执行轨迹 在此静态组装，
  // 历史记忆（digest + 最近对话）与用户输入在 router.js 动态追加。
  const fragments = [
    `=== 系统提示 (SYSTEM) ===\n${promptMd || 'You are Wind Sleep, a personal AI music DJ.'}`,
    `=== 品味语料 (USER CORPUS) ===\n${userCorpus || 'No user taste data provided yet.'}\n\n场景歌单:\n${playlistLines}`,
    `=== 环境注入 (ENVIRONMENT) ===\nDate: ${today}\nTime: ${hour}:00 (${timeLabel(hour)})\nWeather: ${weatherLine}\n今日计划: ${plan?.content || 'No plan set for today.'}`,
    `=== 执行轨迹 (EXECUTION TRACE) ===\n${playsList}`,
  ];

  return fragments.join('\n\n');
}

// --- History compression ---

const SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: '对旧对话的简洁中文摘要，保留用户偏好、情绪与关键请求' },
  },
  required: ['summary'],
};

const RECENT_COUNT = 20;
const SUMMARIZE_EVERY = 10;
let digestState = { count: 0, text: '' };

async function summarizeOlderMessages(allMessages) {
  if (allMessages.length <= RECENT_COUNT) return '';
  const older = allMessages.slice(0, allMessages.length - RECENT_COUNT);
  if (older.length === 0) return '';

  // Re-summarize only when the older window has grown enough, to avoid a Claude call per message.
  if (older.length - digestState.count < SUMMARIZE_EVERY) {
    return digestState.text;
  }

  const transcript = (digestState.text ? `之前的记忆摘要：\n${digestState.text}\n\n` : '') +
    older.map((m) => `[${m.role}]: ${m.content}`).join('\n');

  try {
    const result = await askStructured(
      `请把以下与用户的对话历史压缩成一段简洁的中文记忆，保留：用户的音乐偏好、情绪变化、明确的要求。忽略寒暄。\n\n${transcript}`,
      SUMMARY_SCHEMA,
      { timeout: 15000 },
    );
    digestState = { count: older.length, text: result?.summary || digestState.text };
  } catch (err) {
    console.error('[context] Summarization failed:', err.message);
  }
  return digestState.text;
}

async function buildChatContext(userMessage) {
  const allMessages = getRecentMessages(120);
  const history = allMessages.slice(-RECENT_COUNT);
  const digest = await summarizeOlderMessages(allMessages);
  return { systemPrompt: buildSystemPrompt(), history, digest, userMessage };
}

export { buildSystemPrompt, buildChatContext };
