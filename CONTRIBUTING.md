# Contributing to Wind Sleep

感谢你的兴趣！这是一个个人 AI 音乐电台项目，欢迎任何形式的贡献：bug 报告、功能建议、文档修正、代码 PR。

## 本地开发

```bash
git clone https://github.com/Jacky-J126/wind-sleep.git
cd wind-sleep
npm install
npm --prefix client install
```

依赖服务（可选，没有也能跑）：

- [NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi) at `http://localhost:3000`
- `claude` CLI in PATH（未登录时电台离线兜底）
- `FISH_AUDIO_KEY`（未配置时 TTS 为静音占位）

```bash
npm run dev        # 后端 :8888
npm run client:dev # 前端 :5173
```

## 测试

```bash
npm test            # 单元测试（node --test）
npm run client:build  # 前端构建
```

提交 PR 前请确保 `npm test` 全绿且前端可构建。

## 提交规范

- 一个 PR 只解决一个问题
- 提交信息用中文或英文皆可，建议格式：`类型: 简述`（如 `fix: 修复 sw.js 预缓存路径`）
- 不要提交：`state.json`、`user/ncm-cookie.txt`、`server/tts/`、`.env`、`node_modules/`（均已 gitignore）

## 目录速览

- `server/` — Express + WebSocket 后端（`router.js` 意图分流、`context.js` 六片式组装、`claude.js` CLI 调用、`ncm.js` 音源、`tts.js` 语音）
- `client/` — React PWA（Vite），`src/hooks/useWebSocket.js` WS 客户端、`src/components/AudioPlayer.jsx` 双音频播放
- `user/` — 零代码品味语料
- `server/prompts/` — 系统提示词
