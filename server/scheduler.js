import cron from 'node-cron';
import { setPlan } from './db.js';
import { buildSystemPrompt } from './context.js';
import { askStructured } from './claude.js';

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    plan: { type: 'string', description: '今日整体播放规划描述' },
    moments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          time: { type: 'string' },
          mood: { type: 'string' },
          suggestion: { type: 'string' },
        },
        required: ['time', 'mood', 'suggestion'],
      },
    },
  },
  required: ['plan', 'moments'],
};

let broadcast = null;

function init(onBroadcast) {
  broadcast = onBroadcast;

  // 07:00 — Generate today's plan
  cron.schedule('0 7 * * *', async () => {
    console.log('[scheduler] 07:00 — Generating daily plan');
    const today = new Date().toISOString().slice(0, 10);
    const system = buildSystemPrompt();
    try {
      const result = await askStructured(
        `${system}\n\n请根据用户的品味、环境与日常节律，生成今天一天的播放规划。考虑时间节点，建议 3-5 个音乐时刻。`,
        PLAN_SCHEMA,
      );
      if (result?.plan) {
        setPlan(today, JSON.stringify(result));
        broadcast({ type: 'plan_ready', data: result });
      }
    } catch (err) {
      console.error('[scheduler] Plan generation failed:', err.message);
    }
  });

  // 09:00 — Morning music check-in
  cron.schedule('0 9 * * *', () => {
    console.log('[scheduler] 09:00 — Morning check-in');
    broadcast({ type: 'morning_checkin', data: { time: '09:00', message: '早安，Wind Sleep 为你准备了今天的早间音乐。' } });
  });

  // 00 of every hour during waking hours — mood check (10-22)
  cron.schedule('0 10-22 * * *', () => {
    const hour = new Date().getHours();
    console.log(`[scheduler] ${hour}:00 — Mood check`);
    broadcast({ type: 'mood_check', data: { hour } });
  });

  console.log('[scheduler] Initialized: 07:00 plan / 09:00 morning / hourly mood checks');
}

export { init };
