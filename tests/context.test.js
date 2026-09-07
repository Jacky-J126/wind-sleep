import { test, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-context-test-'));
process.env.WS_STATE_PATH = path.join(tmp, 'state.json');
const db = await import('../server/db.js');
const { buildSystemPrompt } = await import('../server/context.js');

after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('六片式：静态组装包含四个片段标题', () => {
  const prompt = buildSystemPrompt();
  assert.ok(prompt.includes('=== 系统提示 (SYSTEM) ==='));
  assert.ok(prompt.includes('=== 品味语料 (USER CORPUS) ==='));
  assert.ok(prompt.includes('=== 环境注入 (ENVIRONMENT) ==='));
  assert.ok(prompt.includes('=== 执行轨迹 (EXECUTION TRACE) ==='));
});

test('历史记忆与用户输入不在静态组装中（router.js 动态追加）', () => {
  const prompt = buildSystemPrompt();
  assert.ok(!prompt.includes('=== 历史记忆 (MEMORY) ==='));
  assert.ok(!prompt.includes('=== 用户输入 (USER INPUT) ==='));
});

test('品味语料片段包含场景歌单', () => {
  const prompt = buildSystemPrompt();
  assert.ok(prompt.includes('场景歌单:'));
});

test('环境注入片段包含时间与今日计划行', () => {
  const prompt = buildSystemPrompt();
  assert.ok(prompt.includes('Date:'));
  assert.ok(prompt.includes('Weather:'));
  assert.ok(prompt.includes('今日计划:'));
});

test('执行轨迹：无播放记录时显示 No plays yet，有记录时包含曲目与 reason', () => {
  db.init();
  const empty = buildSystemPrompt();
  assert.ok(empty.includes('No plays yet'));
  db.logPlay({ song_name: 'Near Light', artist: 'Ólafur Arnalds', reason: '测试选曲' });
  const withPlay = buildSystemPrompt();
  assert.ok(withPlay.includes('Near Light'));
  assert.ok(withPlay.includes('测试选曲'));
  assert.ok(!withPlay.includes('No plays yet'));
});
