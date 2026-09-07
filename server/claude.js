import { spawn } from 'child_process';

const JSON_SCHEMA = {
  type: 'object',
  properties: {
    say: { type: 'string', description: 'DJ 的中文回应' },
    play: {
      type: ['object', 'null'],
      properties: {
        name: { type: 'string' },
        artist: { type: 'string' },
      },
    },
    reason: { type: ['string', 'null'] },
    segue: { type: ['string', 'null'] },
    action: { type: ['string', 'null'], enum: ['next', 'stop', null] },
  },
  required: ['say', 'play'],
};

function parseOutput(stdout) {
  // Prefer clean JSON parse of the { result: "..." } wrapper.
  try {
    const wrapper = JSON.parse(stdout.trim());
    let inner = wrapper.result;
    if (typeof inner === 'string') {
      try { inner = JSON.parse(inner); } catch { inner = { say: inner }; }
    }
    if (inner && typeof inner === 'object') return inner;
    return wrapper;
  } catch {}

  // Fallback: extract the first JSON object from mixed output.
  const match = stdout.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      let inner = parsed.result;
      if (typeof inner === 'string') inner = JSON.parse(inner);
      return inner && typeof inner === 'object' ? inner : parsed;
    } catch {}
  }
  return { say: stdout.trim() };
}

function runClaude(prompt, { schema, timeout = 60000, cwd } = {}) {
  return new Promise((resolve, reject) => {
    const args = ['-p', '--output-format', 'json'];
    if (schema) args.push('--json-schema', JSON.stringify(schema));

    const child = spawn('claude', args, {
      cwd: cwd || process.cwd(),
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Claude CLI timed out after ${timeout}ms`));
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Claude CLI exited with code ${code}: ${stderr.slice(0, 200)}`));
        return;
      }
      resolve(parseOutput(stdout));
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

async function ask(prompt, opts = {}) {
  const inner = await runClaude(prompt, { schema: JSON_SCHEMA, ...opts });
  return {
    say: inner.say || '',
    play: inner.play || null,
    reason: inner.reason || null,
    segue: inner.segue || null,
    action: inner.action || null,
  };
}

// Generic structured call with a custom JSON schema (used by scheduler, summarizer).
async function askStructured(prompt, schema, opts = {}) {
  return runClaude(prompt, { schema, ...opts });
}

// Offline fallback when Claude is not available
function offlineResponse(message) {
  const greetings = ['你好', '嗨', 'hi', 'hello', 'hey'];
  const lower = message.toLowerCase();
  if (greetings.some((g) => lower.includes(g))) {
    return { say: '嗨，你好！我是 Wind Sleep，你的私人音乐 DJ。告诉我你的心情，或者 /play 歌名 直接点歌，我马上为你安排好音乐。', play: null };
  }

  const rules = [
    [/焦虑|压力|烦躁|紧张/, { say: '放轻松，先来一段极简钢琴，把心里的杂音慢慢沉下来。', play: { name: 'Near Light', artist: 'Ólafur Arnalds' }, reason: '极简钢琴与弦乐，帮你从紧绷里退一步' }],
    [/疲惫|好累|累|困/, { say: '累了就靠一会儿，来点不费力的爵士嘻哈，提神但不吵。', play: { name: 'Luv(sic) pt.3', artist: 'Nujabes' }, reason: '爵士嘻哈经典，轻快鼓点与钢琴采样' }],
    [/开心|高兴|兴奋|好心情/, { say: '好心情要趁热，来首有节奏的氛围电子。', play: { name: '3055', artist: 'Ólafur Arnalds' }, reason: '渐进的氛围感，适合乘着好心情' }],
    [/伤感|难过|低落|emo/, { say: '我陪你待一会儿，这首温暖弦乐，不放大情绪，只是陪着。', play: { name: 'On the Nature of Daylight', artist: 'Max Richter' }, reason: '温暖弦乐，陪伴而不加深情绪' }],
    [/专注|工作|学习|写/, { say: '给你一段无歌词的纯音乐，不打断心流。', play: { name: '3055', artist: 'Ólafur Arnalds' }, reason: '无歌词氛围，适合深度专注' }],
    [/失眠|睡不着|入睡|睡觉/, { say: '深夜了，把音量调低，这段长音氛围带你慢慢入睡。', play: { name: 'Prelude in D Flat Major', artist: 'Max Richter' }, reason: '长音氛围与钢琴，引导入睡' }],
    [/安静|放松|平静|轻/, { say: '安静的纯音乐是个不错的选择，让我想起 Ólafur Arnalds 的钢琴曲。', play: { name: '3055', artist: 'Ólafur Arnalds' }, reason: '冰岛作曲家，极简钢琴与弦乐，适合安静时刻' }],
    [/活力|能量|提神|快/, { say: '来点有节奏感的音乐，帮你提提神。', play: { name: 'Luv(sic) pt.3', artist: 'Nujabes' }, reason: '爵士嘻哈经典，轻快的鼓点和钢琴采样' }],
  ];

  for (const [pattern, response] of rules) {
    if (pattern.test(message)) return response;
  }
  return null; // No offline match
}

export { ask, askStructured, offlineResponse };
