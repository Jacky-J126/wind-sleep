import { test } from 'node:test';
import assert from 'node:assert';
import { parseOutput, offlineResponse, claudeAvailable } from '../server/claude.js';

test('parseOutput: { result: "..." } 包装 + 内部为 JSON 字符串', () => {
  const out = parseOutput(JSON.stringify({ result: JSON.stringify({ say: 'hi', play: null }) }));
  assert.strictEqual(out.say, 'hi');
});

test('parseOutput: { result: "..." } 包装 + 内部为纯文本', () => {
  const out = parseOutput(JSON.stringify({ result: 'just some text' }));
  assert.strictEqual(out.say, 'just some text');
});

test('parseOutput: 裸 JSON', () => {
  const out = parseOutput(JSON.stringify({ say: '裸 JSON', play: { name: 'X' } }));
  assert.strictEqual(out.say, '裸 JSON');
  assert.strictEqual(out.play.name, 'X');
});

test('parseOutput: 混合输出中提取第一个 JSON 对象', () => {
  const out = parseOutput('前缀噪音\n{"say":"提取成功","reason":"r"}\n后缀');
  assert.strictEqual(out.say, '提取成功');
});

test('parseOutput: 完全无法解析 → 原文作为 say', () => {
  const out = parseOutput('这不是 JSON');
  assert.strictEqual(out.say, '这不是 JSON');
});

test('offlineResponse: 问候', () => {
  const r = offlineResponse('你好');
  assert.ok(r.say.includes('Wind Sleep'));
  assert.strictEqual(r.play, null);
});

test('offlineResponse: 情绪规则命中 → 返回歌曲', () => {
  const r = offlineResponse('我今天好焦虑');
  assert.ok(r.say.length > 0);
  assert.strictEqual(r.play.name, 'Near Light');
  assert.ok(r.reason.length > 0);
});

test('offlineResponse: 多条规则取第一条', () => {
  const r = offlineResponse('疲惫又焦虑');
  assert.strictEqual(r.play.name, 'Near Light'); // 焦虑规则在前
});

test('offlineResponse: 无匹配 → null', () => {
  assert.strictEqual(offlineResponse('量子力学和弦理论'), null);
});

test('claudeAvailable: 返回布尔值', () => {
  assert.strictEqual(typeof claudeAvailable(), 'boolean');
});
