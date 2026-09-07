# 🌬️ Wind Sleep

<div align="center">

**个人 AI 音乐电台** — Claude 读懂你的品味，规划一整天的声音，像 DJ 一样说话、选曲、切歌。

*Your personal AI radio — Claude reads your taste, plans the sound of your day, and DJs it.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/Jacky-J126/wind-sleep/actions/workflows/ci.yml/badge.svg)](https://github.com/Jacky-J126/wind-sleep/actions)

</div>

---

## 目录 / Table of Contents

- [这是什么 / What is this](#这是什么--what-is-this)
- [架构 / Architecture](#架构--architecture)
- [快速开始 / Quick Start](#快速开始--quick-start)
- [环境变量 / Environment Variables](#环境变量--environment-variables)
- [API 参考 / API Reference](#api-参考--api-reference)
- [六片式提示词工程 / Six-Piece Prompt Pipeline](#六片式提示词工程--six-piece-prompt-pipeline)
- [零代码品味语料 / Zero-Code Taste Corpus](#零代码品味语料--zero-code-taste-corpus)
- [TTS 说明 / TTS Notes](#tts-说明--tts-notes)
- [安全说明 / Security Notes](#安全说明--security-notes)
- [测试 / Testing](#测试--testing)
- [免责声明 / Disclaimer](#免责声明--disclaimer)
- [License](#license)

## 这是什么 / What is this

Wind Sleep 是一个针对**音乐软件情感化交互**的全栈 AI 电台：你说一句话（"我有点悲伤"），它用 Claude Code CLI 做自然语言意图解析与 DJ 解说生成，通过严格 JSON Schema 约束输出转化为确定性的播放指令，再从网易云音乐取音源、用 Fish Audio 合成语音，WebSocket 推流到 React PWA 前端——近零感知延迟地完成"解说 → 播歌 → 自动切歌"的完整电台循环。

**核心特性**

- 🎧 **AI DJ 闭环**：聊天点歌 → DJ 解说 → 播放 → 播完自动切歌，无需手动操作
- 🧠 **Claude Code CLI 推理**：`claude -p --output-format json` + 严格 JSON Schema，把生成式模型的不可控输出收敛为确定性指令
- 🧩 **六片式提示词组装**：系统提示 + 品味语料 + 环境注入 + 历史记忆 + 用户输入 + 执行轨迹，模块化组装 + 动态压缩，解决上下文窗口过载
- ⚡ **实时推流**：WebSocket 长连接推送 TTS 音频与播放状态（`{event, data, ts}` 事件信封），DJ 旁白期间音乐自动压低（ducking）
- 📻 **多维上下文选曲**：天气、情绪、日常节律、场景歌单共同决定播放规划
- ✍️ **零代码品味语料**：Markdown/JSON 文件即配置，无需微调即可深度定制电台风格

## 架构 / Architecture

```
                       ┌────────────────────────────────────────────┐
                       │                 Wind Sleep                 │
                       │                                            │
 user/ (品味语料)        │  server/                                   │
 taste.md ──────────┐  │  ┌─────────────┐   ┌────────────────────┐  │
 routines.md ───────┤  │  │ context.js  │   │  router.js          │  │
 mood-rules.md ─────┼─▶│  │ 六片式组装    │──▶│ 意图分流             │  │
 playlists.json ────┘  │  └─────────────┘   │ /play /next 正则路由  │  │
                       │        │          │ 自然语言 → Claude     │  │
 环境注入               │        ▼          └─────────┬──────────┘  │
 天气 (wttr.in) ───────▶│  ┌─────────────┐            ▼             │
 时间/日常节律 ────────▶│  │ claude.js   │  {say, play, reason,     │
                       │  │ claude -p   │   segue, action}          │
                       │  │ --json-schema│         │                │
                       │  └─────────────┘         ▼                │
                       │              ┌────────────────────┐        │
 网易云音乐 ◀────────────│──────────────│ ncm.js 搜索/校验可播  │        │
 (NeteaseCloudMusicApi)│              └─────────┬──────────┘        │
                       │                        ▼                   │
                       │              ┌────────────────────┐        │
 Fish Audio TTS ◀──────│──────────────│ tts.js (MD5 缓存)    │        │
                       │              └─────────┬──────────┘        │
                       │                        │                   │
                       │              ┌────────────────────┐        │
                       │              │ WS /stream          │        │
                       │              │ {event, data, ts}    │        │
                       └──────────────┴─────────┬──────────┴────────┘
                                                ▼
                                  client/ (React PWA, Vite)
                                  Player / Profile / Settings
```

## 快速开始 / Quick Start

### 1. 前置依赖 / Prerequisites

- Node.js ≥ 18
- [NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi) 运行在 `http://localhost:3000`（默认，可用 `NCM_BASE` 覆盖）
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) 在 PATH 中且已登录（未安装/未登录时电台降级为离线兜底模式）
- Fish Audio API key（可选，见下方 TTS 说明）

### 2. 安装 / Install

```bash
git clone https://github.com/Jacky-J126/wind-sleep.git
cd wind-sleep
npm install                   # 根依赖（Express / ws / node-cron）
npm --prefix client install   # 前端依赖（React / Vite）
```

### 3. 配置 / Configure

```bash
cp .env.example .env
# 编辑 .env，填入 FISH_AUDIO_KEY 等（不填也能跑，TTS 用静音占位）
```

### 4. 运行 / Run

```bash
# 生产模式（构建前端 + 启动服务，访问 http://localhost:8888）
npm start

# 或开发模式
npm run dev            # 后端 :8888
npm run client:dev     # 前端 :5173（开发时访问 5173）
```

浏览器打开 `http://localhost:8888`，发送一句"我有点悲伤"或 `/play 后摇` 开始收听。

## 环境变量 / Environment Variables

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `8888` | 服务端口 |
| `HOST` | `127.0.0.1` | 监听地址（见安全说明） |
| `FISH_AUDIO_KEY` | — | Fish Audio API key，不填则 TTS 输出静音占位 |
| `FISH_AUDIO_VOICE` | `default` | Fish Audio 音色 ID |
| `NCM_BASE` | `http://localhost:3000` | NeteaseCloudMusicApi 地址 |
| `WS_STATE_PATH` | `./state.json` | 运行时状态文件路径（测试/多实例用） |

## API 参考 / API Reference

### HTTP

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/chat` | 对话入口。`{"message":"..."}` → `{say, play, reason, segue, tts, action}` |
| GET | `/api/now` | 当前播放曲目 |
| GET | `/api/next` | 自动切歌候选（场景歌单/兜底关键词中挑可播曲目） |
| GET | `/api/status` | 依赖服务状态：`{hasFishKey, claudeAvailable, ncmUp}` |
| GET | `/api/plan/today` | 今日播放规划 |
| GET | `/api/taste` | 读取品味语料文件 |
| POST | `/api/taste` | 保存品味语料文件：`{"file":"taste.md","content":"..."}` |
| GET | `/api/history` | 最近对话历史 |
| GET | `/api/ncm/stream/:id` | 同源 Range 音频代理（支持 seek，转发 206 响应） |

`action` 字段：`next`（切下一首）/ `stop`（停止播放）/ `null`。

### WebSocket `/stream`

统一事件信封 `{event, data, ts}`，握手消息携带协议版本：

| event | data | 说明 |
|-------|------|------|
| `connected` | `{protocol: "wind-sleep/1", time}` | 连接握手 |
| `track_change` | `{play, tts, reason, segue}` | 曲目切换（含旁白音频 URL） |
| `plan_ready` | `{plan, moments}` | 今日计划生成完成 |
| `morning_checkin` | `{time, message}` | 早间问候 |
| `mood_check` | `{hour}` | 整点心情提示 |

## 六片式提示词工程 / Six-Piece Prompt Pipeline

每次对话请求，后端按模块化管线组装提示词，各片段独立维护、动态压缩：

1. **系统提示 (SYSTEM)** — DJ 人设与输出格式约束（`server/prompts/default.md`）
2. **品味语料 (USER CORPUS)** — `user/` 目录的 taste/routines/mood-rules/playlists 原文注入
3. **环境注入 (ENVIRONMENT)** — 当前时间、天气（wttr.in）、今日计划
4. **历史记忆 (MEMORY)** — 最近 20 条对话 + 滚动 digest（有界记忆，避免无限膨胀）
5. **用户输入 (USER INPUT)** — 本次聊天消息
6. **执行轨迹 (EXECUTION TRACE)** — 最近播放记录（含选曲 reason 与过渡语 segue）

通过 `--json-schema` 强制输出 `{say, play, reason, segue, action}`，后端再做字段级 fallback（离线兜底规则书），保证"生成模型不可控"下播放链路依然确定性可执行。

## 零代码品味语料 / Zero-Code Taste Corpus

无需改代码、无需微调，编辑 `user/` 目录下的 Markdown/JSON 文件即可定制电台：

| 文件 | 作用 |
|------|------|
| `taste.md` | 音乐品味描述（喜欢的风格/艺人/场景） |
| `routines.md` | 日常节律（起床、通勤、工作、睡前） |
| `mood-rules.md` | 情绪 → 音乐映射规则 |
| `playlists.json` | 场景歌单关键词（morning/focus/evening/night/weekend），自动切歌从这里取词 |

也可在前端「品味」页直接编辑（走 `POST /api/taste`）。

## TTS 说明 / TTS Notes

- 默认**不配置** `FISH_AUDIO_KEY` 时，TTS 输出静音占位音频（`assets/silence.mp3`），电台全链路（解说节奏、ducking、自动切歌）可完整走查
- 配置真实 key 后，旁白由 [Fish Audio](https://fish.audio) 合成，并按内容 MD5 缓存在 `server/tts/`（已 gitignore）
- 音色通过 `FISH_AUDIO_VOICE` 指定

## 安全说明 / Security Notes

- **默认只监听 `127.0.0.1`**。若需手机等局域网设备访问，设 `HOST=0.0.0.0`——但请注意：本服务无鉴权，任何能访问该端口的设备都可调用 `/api/chat` 与 `/api/taste`，请仅在可信网络内暴露
- 网易云登录 cookie 保存在 `user/ncm-cookie.txt`（已 gitignore），勿提交到仓库
- 运行时数据（`state.json`、TTS 缓存、cookie）均已 gitignore

## 测试 / Testing

```bash
npm test          # node --test 单元测试（router/context/claude/ncm/db）
npm run client:build  # 前端构建
```

CI（GitHub Actions）在 Node 18/20/22 矩阵上运行 `npm ci` → `npm test` → 构建。

## 真实模式验证 / Real-Mode Verification

mock 模式（默认）下 TTS 为静音占位，音源依赖本机 NCM。想验证完整真实链路：

1. 启动 [NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi) 于 `localhost:3000`，并运行 `npm run ncm:login` 完成扫码登录（写入 `user/ncm-cookie.txt`，用于解锁 VIP 歌曲播放地址）
2. 确认 `claude` CLI 已登录（`claude --version` 可用；`GET /api/status` 返回 `claudeAvailable: true`）
3. `.env` 填入 `FISH_AUDIO_KEY` 与 `FISH_AUDIO_VOICE`
4. `npm start` 后打开 `http://localhost:8888`，发一句"我有点悲伤"——应听到 DJ 语音旁白（fish.audio 合成），随后自动播放真实音乐，播完自动切下一首
5. 检查 Settings 页：模型/TTS/NCM 三项均显示就绪

## 免责声明 / Disclaimer

本项目仅供个人学习与自用研究。音源通过 **非官方** 的 NeteaseCloudMusicApi 获取，仅供技术演示，请勿用于商业用途；如涉及版权问题请联系仓库作者处理。Fish Audio、网易云音乐、Claude 均为各权利方商标，本项目与其无隶属关系。

*This project is for personal learning and research only. Audio sources are fetched via the **unofficial** NeteaseCloudMusicApi for technical demonstration. All third-party service trademarks belong to their respective owners.*

## License

[MIT](LICENSE) © 2025 Jacky-J126
