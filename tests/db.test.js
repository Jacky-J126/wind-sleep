import { test, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';

// 必须在 import db.js 之前设置，db.js 在模块加载时读取 WS_STATE_PATH
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-db-test-'));
process.env.WS_STATE_PATH = path.join(tmp, 'state.json');
const db = await import('../server/db.js');

after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('init 时状态文件不存在 → 使用迁移安全的默认值', () => {
  const state = db.init();
  assert.deepStrictEqual(state.messages, []);
  assert.deepStrictEqual(state.plays, []);
  assert.deepStrictEqual(state.plans, {});
  assert.deepStrictEqual(state.prefix, {});
});

test('logMessage/logPlay 持久化到 WS_STATE_PATH 文件', () => {
  const msg = db.logMessage('user', '我有点悲伤');
  const play = db.logPlay({ song_id: '1', song_name: 'Near Light', artist: 'Ólafur Arnalds', reason: 'test' });
  assert.ok(fs.existsSync(process.env.WS_STATE_PATH));
  const onDisk = JSON.parse(fs.readFileSync(process.env.WS_STATE_PATH, 'utf-8'));
  assert.strictEqual(onDisk.messages.length, 1);
  assert.strictEqual(onDisk.messages[0].content, '我有点悲伤');
  assert.strictEqual(onDisk.plays[0].song_name, 'Near Light');
  assert.ok(Number(play.id) > Number(msg.id), 'id 递增');
});

test('重新 init 时从已有数据恢复 idCounter，新 id 不回退', () => {
  db.init(); // reload from disk
  const entry = db.logMessage('system', 'after reload');
  const allIds = [...db.getRecentMessages(100), ...db.getRecentPlays(100)].map((e) => Number(e.id));
  assert.ok(Number(entry.id) >= Math.max(...allIds.filter(Boolean)) - 1, '新 id 不回退');
});

test('getPlan 解析 JSON 字符串内容', () => {
  db.setPlan('2026-09-07', JSON.stringify({ plan: '今天听氛围', moments: [] }));
  const plan = db.getPlan('2026-09-07');
  assert.strictEqual(plan.plan.plan, '今天听氛围');
  assert.deepStrictEqual(plan.plan.moments, []);
  assert.strictEqual(db.getPlan('2000-01-01'), null);
});

test('getRecentPlays 倒序（最近在前）', () => {
  db.logPlay({ song_name: 'first' });
  db.logPlay({ song_name: 'second' });
  const recent = db.getRecentPlays(10);
  assert.strictEqual(recent[0].song_name, 'second');
  assert.strictEqual(recent[1].song_name, 'first');
});
