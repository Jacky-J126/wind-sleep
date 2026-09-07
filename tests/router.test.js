import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-router-test-'));
process.env.WS_STATE_PATH = path.join(tmp, 'state.json');
const db = await import('../server/db.js');
const router = await import('../server/router.js');

const realFetch = globalThis.fetch;
const okJson = (data) => ({
  ok: true,
  status: 200,
  async json() { return data; },
});

function mockNcm({ songs, url } = {}) {
  globalThis.fetch = async (u) => {
    if (String(u).includes('/search?')) return okJson({ result: { songs: songs || [] } });
    if (String(u).includes('/song/url?')) return okJson({ data: [{ url: url || null }] });
    return okJson({});
  };
}

before(() => db.init());
after(() => fs.rmSync(tmp, { recursive: true, force: true }));
afterEach(() => { globalThis.fetch = realFetch; });

test('matchIntent: 快指令与自然语言分流', () => {
  assert.deepStrictEqual(router.matchIntent('/play 后摇'), { intent: 'play', arg: '后摇' });
  assert.deepStrictEqual(router.matchIntent('/next'), { intent: 'next', arg: null });
  assert.deepStrictEqual(router.matchIntent('/stop'), { intent: 'stop', arg: null });
  assert.deepStrictEqual(router.matchIntent('/taste 我喜欢爵士'), { intent: 'taste', arg: '我喜欢爵士' });
  assert.deepStrictEqual(router.matchIntent('我有点悲伤'), { intent: 'chat', arg: '我有点悲伤' });
});

test('route /next → action next；/stop → action stop', async () => {
  const next = await router.route('/next');
  assert.strictEqual(next.action, 'next');
  assert.strictEqual(next.play, null);
  const stop = await router.route('/stop');
  assert.strictEqual(stop.action, 'stop');
});

test('route /help → 返回指令说明', async () => {
  const help = await router.route('/help');
  assert.ok(help.say.includes('/play'));
  assert.ok(help.say.includes('/recommend'));
});

test('route /play 命中可播歌曲 → 返回同源代理 URL 并记录播放', async () => {
  mockNcm({
    songs: [{ id: 1, name: 'Near Light', artists: [{ name: 'Ólafur Arnalds' }], album: { name: 'A' } }],
    url: 'http://cdn.example/near-light.mp3',
  });
  const result = await router.route('/play Near Light');
  assert.strictEqual(result.play.name, 'Near Light');
  assert.strictEqual(result.play.url, '/api/ncm/stream/1', '播放地址必须是同源 Range 代理');
  assert.ok(result.say.includes('Near Light'));
  const plays = db.getRecentPlays(10);
  assert.strictEqual(plays[0].song_name, 'Near Light');
});

test('route /play 搜不到 → 明确提示；可搜但全不可播 → 版权提示', async () => {
  mockNcm({ songs: [] });
  const none = await router.route('/play 不存在的歌');
  assert.ok(none.say.includes('没有找到'));
  assert.strictEqual(none.play, null);

  mockNcm({
    songs: [
      { id: 2, name: 'VIP歌', artists: [{ name: 'A' }], album: { name: '' } },
      { id: 3, name: 'VIP歌2', artists: [{ name: 'B' }], album: { name: '' } },
    ],
    url: null,
  });
  const locked = await router.route('/play VIP歌');
  assert.ok(locked.say.includes('版权保护'));
  assert.strictEqual(locked.play, null);
});

test('sceneKeywordsForNow: 返回数组（playlists.json 存在时含场景词）', () => {
  const keywords = router.sceneKeywordsForNow();
  assert.ok(Array.isArray(keywords));
});

test('saveTasteFile: 拒绝白名单之外的文件名', () => {
  // 注意：白名单内的合法文件名会真实写入 user/ 目录，测试只验证拒绝路径
  const r = router.saveTasteFile('../evil.md', 'x');
  assert.ok(r.error);
  const r2 = router.saveTasteFile('random.txt', 'x');
  assert.ok(r2.error);
});
