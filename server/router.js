import { ask, offlineResponse } from './claude.js';
import { buildChatContext } from './context.js';
import { logMessage, logPlay } from './db.js';
import { search as ncmSearch, songUrl, recommend as ncmRecommend } from './ncm.js';
import { synthesize } from './tts.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PATTERNS = {
  play: /^\/play\s+(.+)/i,
  next: /^\/next/i,
  stop: /^\/stop/i,
  taste: /^\/taste\s+(.+)/i,
  recommend: /^\/recommend/i,
  help: /^\/help/i,
};

function matchIntent(text) {
  for (const [intent, pattern] of Object.entries(PATTERNS)) {
    const m = text.match(pattern);
    if (m) return { intent, arg: m[1] || null };
  }
  return { intent: 'chat', arg: text };
}

// 从 DJ 回复里提取《歌名》，用于 play 缺失时兜底
function extractSongName(text) {
  if (!text) return null;
  const m = text.match(/《([^》]+)》/);
  return m ? m[1].trim() : null;
}

// 同源 Range 代理地址：避免直连 CDN 的 referer/过期问题，前端可正常 seek
function streamUrl(id) {
  return `/api/ncm/stream/${id}`;
}

// 从候选歌曲中随机挑出第一首有可播 URL 的（跳过版权/VIP 受限）
async function pickPlayable(songs, maxTries = 5) {
  const pool = [...songs].sort(() => Math.random() - 0.5).slice(0, maxTries);
  for (const s of pool) {
    const u = await songUrl(s.id);
    if (u) return { ...s, url: streamUrl(s.id) };
  }
  return null;
}

async function handlePlay(keyword) {
  const songs = await ncmSearch(keyword, 5);
  if (!songs || songs.length === 0) {
    return { say: `没有找到「${keyword}」相关的歌曲`, play: null };
  }
  const picked = await pickPlayable(songs);
  if (!picked) {
    return { say: `找到「${keyword}」相关歌曲，但都受版权保护暂时无法播放，换个关键词试试？`, play: null };
  }
  logPlay({
    song_id: picked.id,
    song_name: picked.name,
    artist: picked.artist,
    reason: `用户指令: /play ${keyword}`,
  });
  return {
    say: `正在播放 ${picked.name} — ${picked.artist}`,
    play: picked,
    reason: `用户点播: ${keyword}`,
  };
}

const FALLBACK_KEYWORDS = ['后摇', '氛围电子', '爵士嘻哈', 'Ólafur Arnalds', 'Max Richter'];

// 根据当前时段从 user/playlists.json 挑场景关键词，用于自动切歌
function sceneKeywordsForNow() {
  const now = new Date();
  const hour = now.getHours();
  const weekend = now.getDay() === 0 || now.getDay() === 6;
  let scene = 'night';
  if (hour >= 6 && hour < 10) scene = 'morning';
  else if (hour >= 10 && hour < 14) scene = 'focus';
  else if (hour >= 14 && hour < 18) scene = 'afternoon';
  else if (hour >= 18 && hour < 22) scene = 'evening';
  try {
    const playlists = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'user', 'playlists.json'), 'utf-8')
    );
    const sceneKw = playlists[scene] || [];
    const weekendKw = weekend ? playlists.weekend || [] : [];
    return [...sceneKw, ...weekendKw].filter(Boolean);
  } catch {
    return [];
  }
}

// 自动切歌：优先当前场景关键词，最多尝试 3 个关键词
async function handleNext() {
  const keywords = [...sceneKeywordsForNow(), ...FALLBACK_KEYWORDS].slice(0, 3);
  for (const kw of keywords) {
    const songs = await ncmSearch(kw, 5);
    const picked = await pickPlayable(songs);
    if (picked) {
      logPlay({ song_id: picked.id, song_name: picked.name, artist: picked.artist, reason: '自动切歌' });
      return { ...picked, reason: '自动切歌' };
    }
  }
  return null;
}

async function handleRecommend() {
  let songs = await ncmRecommend();
  if (!songs || songs.length === 0) {
    for (const kw of FALLBACK_KEYWORDS) {
      songs = await ncmSearch(kw, 3);
      if (songs && songs.length > 0) break;
    }
  }
  if (!songs || songs.length === 0) {
    return { say: '抱歉，暂时获取不到推荐歌曲。试试 /play 歌名 直接点歌？', play: null };
  }
  const picked = await pickPlayable(songs);
  if (!picked) {
    return { say: '推荐列表里的歌暂时都受版权保护，稍后再试试？', play: null };
  }
  logPlay({ song_id: picked.id, song_name: picked.name, artist: picked.artist, reason: '系统推荐' });
  return {
    say: `为你推荐一首新歌：${picked.name} — ${picked.artist}`,
    play: picked,
    reason: '每日新鲜推荐',
  };
}

async function route(userMessage, { cwd, broadcast } = {}) {
  const { intent, arg } = matchIntent(userMessage);

  // Fast commands — no Claude needed
  if (intent === 'play') return handlePlay(arg);
  if (intent === 'next') return { say: '好的，切到下一首', action: 'next', play: null };
  if (intent === 'stop') return { say: '已停止播放', action: 'stop', play: null };
  if (intent === 'recommend') return handleRecommend();
  if (intent === 'help') {
    return {
      say: '你可以：\n/play 歌名 — 直接点歌\n/next — 下一首\n/stop — 停止\n/recommend — 随机推荐\n直接聊天 — AI DJ 为你选歌',
      play: null,
    };
  }
  if (intent === 'taste') {
    const tasteFile = path.join(__dirname, '..', 'user', 'taste.md');
    try {
      fs.appendFileSync(tasteFile, `\n${arg}\n`, 'utf-8');
      return { say: `已记录你的品味: ${arg}`, action: 'save_taste', data: arg };
    } catch {
      return { say: '保存失败，请直接编辑 user/taste.md 文件', play: null };
    }
  }

  // Natural language → Claude
  // 六片式：系统提示/品味语料/环境注入/执行轨迹（context.js）+ 历史记忆/用户输入（此处）
  const { systemPrompt, history, digest } = await buildChatContext(arg);

  const claudePrompt = `${systemPrompt}

=== 历史记忆 (MEMORY) ===
${digest || '(none)'}

最近对话:
${history.map((m) => `[${m.role}]: ${m.content}`).join('\n')}

=== 用户输入 (USER INPUT) ===
${arg}

Respond with JSON per the schema.`;

  logMessage('user', userMessage);

  // Try offline pattern matching first
  const offline = offlineResponse(userMessage);
  if (offline) {
    logMessage('assistant', offline.say, { play: offline.play, reason: offline.reason, source: 'offline' });
    if (offline.play) {
      const songs = await ncmSearch(offline.play.name + ' ' + (offline.play.artist || ''), 1);
      if (songs.length > 0) {
        const url = await songUrl(songs[0].id);
        if (url) offline.play = { ...songs[0], url: streamUrl(songs[0].id) };
      }
      logPlay({
        song_id: offline.play.id,
        song_name: offline.play.name,
        artist: offline.play.artist,
        reason: offline.reason,
      });
    }
    if (offline.say) {
      const tts = await synthesize(offline.say);
      offline.tts = tts.url;
    }
    return offline;
  }

  try {
    const result = await ask(claudePrompt, { cwd: cwd || process.cwd() });

    // 兜底：Claude 有时在 say 里提到歌曲却没填 play，从《歌名》提取并补上
    if (!result.play?.name) {
      const guess = extractSongName(result.say);
      if (guess) result.play = { name: guess, artist: '' };
    }

    if (result.play?.name) {
      let songs = await ncmSearch(result.play.name + ' ' + (result.play.artist || ''), 1);
      if (!songs.length) songs = await ncmSearch(result.play.name, 1);
      if (songs.length > 0) {
        const url = await songUrl(songs[0].id);
        result.play = { ...songs[0], url: url ? streamUrl(songs[0].id) : null };
      } else {
        result.play.url = null;
      }
    }

    logMessage('assistant', result.say || '', { play: result.play, reason: result.reason, segue: result.segue, source: 'claude' });

    if (result.play?.id) {
      logPlay({
        song_id: result.play.id,
        song_name: result.play.name,
        artist: result.play.artist,
        reason: result.reason,
        segue: result.segue,
        url: result.play.url,
      });
    }

    // Synthesize TTS
    if (result.say) {
      const tts = await synthesize(result.say);
      result.tts = tts.url;
    }

    // Broadcast to WebSocket clients
    if (broadcast) {
      broadcast('track_change', result);
    }

    return result;
  } catch (err) {
    console.error('[router] Claude error:', err.message);
    logMessage('system', `Error: ${err.message}`);

    // Fallback: use offline response if available
    const fallback = offlineResponse(userMessage);
    if (fallback) {
      logMessage('assistant', fallback.say, { play: fallback.play, source: 'fallback' });
      return fallback;
    }

    return {
      say: '抱歉，我的 AI 大脑暂时离线了。你可以试试 /play 歌名 直接点歌，或 /recommend 随机推荐。',
      play: null,
    };
  }
}

// Save taste files endpoint handler
function saveTasteFile(filename, content) {
  const userDir = path.join(__dirname, '..', 'user');
  const filePath = path.join(userDir, filename);
  const allowed = ['taste.md', 'routines.md', 'mood-rules.md', 'playlists.json'];
  if (!allowed.includes(filename)) {
    return { error: `File must be one of: ${allowed.join(', ')}` };
  }
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true, file: filename };
  } catch (err) {
    return { error: err.message };
  }
}

export { route, matchIntent, saveTasteFile, handlePlay, handleRecommend, handleNext, pickPlayable, sceneKeywordsForNow };
