import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { search, songUrl, ping } from '../server/ncm.js';

const realFetch = globalThis.fetch;
let requestLog = [];

function mockFetch(handler) {
  globalThis.fetch = async (url, opts) => {
    requestLog.push({ url: String(url), opts });
    return handler(url, opts);
  };
}

afterEach(() => {
  globalThis.fetch = realFetch;
  requestLog = [];
});

const okJson = (data) => ({
  ok: true,
  status: 200,
  async json() { return data; },
});

test('search: 结果映射为 {id,name,artist,album}', async () => {
  mockFetch(() => okJson({
    result: { songs: [{ id: 123, name: 'X', artists: [{ name: 'A' }, { name: 'B' }], album: { name: 'AL' } }] },
  }));
  const songs = await search('测试', 5);
  assert.strictEqual(songs.length, 1);
  assert.deepStrictEqual(songs[0], { id: '123', name: 'X', artist: 'A, B', album: 'AL' });
  assert.ok(requestLog[0].url.includes('/search?keywords='));
});

test('search: 无结果 → []，请求失败 → []', async () => {
  mockFetch(() => okJson({ result: {} }));
  assert.deepStrictEqual(await search('无', 5), []);
  globalThis.fetch = async () => { throw new Error('network down'); };
  assert.deepStrictEqual(await search('断网', 5), []);
});

test('songUrl: 无 cookie 时不带 cookie 参数，有 url 才返回', async () => {
  mockFetch(() => okJson({ data: [{ url: 'http://music.example/1.mp3' }] }));
  const url = await songUrl('1');
  assert.strictEqual(url, 'http://music.example/1.mp3');
  assert.ok(!requestLog[0].url.includes('cookie='), '未登录时不应附加 cookie');
});

test('songUrl: 无播放地址 → null', async () => {
  mockFetch(() => okJson({ data: [{}] }));
  assert.strictEqual(await songUrl('2'), null);
});

test('ping: 响应 ok → true，网络错误 → false', async () => {
  mockFetch(() => ({ ok: true }));
  assert.strictEqual(await ping(), true);
  globalThis.fetch = async () => { throw new Error('down'); };
  assert.strictEqual(await ping(), false);
});
