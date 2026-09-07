# Wind Sleep — 个人 AI 音乐电台

## 架构概览

```
user/                        # 你的品味语料 (taste.md, routines.md, mood-rules.md, playlists.json)
  ↓
server/router.js             # 意图分流 (/play, /next, /stop, 自然语言→Claude)
  ↓
server/context.js            # 6 片 prompt 组装 (系统+品味+环境+历史+输入+轨迹)
  ↓
server/claude.js             # spawn claude CLI 子进程 (claude -p --output-format json)
  ↓
{ say, play, reason, segue } # 解析结果 → ncm 搜歌 → tts 合成 → WS 推前端
  ↓
client/                      # React PWA (Player / Profile / Settings 三视图)
```

## 启动

```bash
# 终端 1: 启动后端
npm run dev

# 终端 2: 启动前端开发服务器
npm run client:dev
```

开发时前端访问 `http://localhost:5173`，生产构建后访问 `http://localhost:8888`。

## API

| Method | Path | 说明 |
|--------|------|------|
| POST | /api/chat | 对话: `{"message":"..."}` → `{say, play, reason, segue, tts}` |
| GET | /api/now | 当前播放 |
| GET | /api/next | 下一首预览 |
| GET | /api/taste | 读取品味文件 |
| POST | /api/taste | 保存品味文件: `{"file":"taste.md","content":"..."}` |
| GET | /api/plan/today | 今日播放规划 |
| GET | /api/history | 对话历史 |
| WS | /stream | 实时推送 |

## 目录

- `server/` — Node.js 后端 (Express + WebSocket)
- `client/` — React PWA 前端 (Vite)
- `user/` — 用户品味语料 (Markdown + JSON)
- `assets/` — 静态资源
- `state.json` — 运行时状态 (自动生成)

## 依赖服务

- **NeteaseCloudMusicApi**: 需在 `http://localhost:3000` 运行
- **Fish Audio TTS**: 可选，设置环境变量 `FISH_AUDIO_KEY`
- **Claude Code CLI**: 需在 PATH 中，使用 `claude -p` 子进程调用
- **天气 (wttr.in)**: 自动按 IP 定位，无需 key，启动时后台刷新并每 30 分钟更新

## 编辑品味

可在前端「品味」页直接编辑保存（走 `POST /api/taste`），也可直接编辑 `user/` 目录下的文件：
- `taste.md` — 音乐品味描述
- `routines.md` — 日常节律
- `mood-rules.md` — 情绪→音乐映射
- `playlists.json` — 场景歌单映射（已注入选曲上下文）
