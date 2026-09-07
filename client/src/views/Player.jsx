import { useState, useCallback, useRef, useEffect } from 'react';
import AudioPlayer from '../components/AudioPlayer';
import ChatStream from '../components/ChatStream';
import NowPlaying from '../components/NowPlaying';
import useWebSocket from '../hooks/useWebSocket';

export default function Player() {
  const [messages, setMessages] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [announceUrl, setAnnounceUrl] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState(null);
  const [moodHint, setMoodHint] = useState(null);
  const { lastMessage, connected } = useWebSocket();
  const audioRef = useRef(null);
  const playErrorShown = useRef(false);
  const announceRef = useRef(null);
  announceRef.current = announceUrl;

  const handlePlayError = useCallback(() => {
    if (playErrorShown.current) return;
    playErrorShown.current = true;
    setMessages((prev) => [...prev, { role: 'system', content: '播放被浏览器拦截了，点一下页面任意位置即可恢复声音。' }]);
  }, []);

  // 自动切歌：向 /api/next 要一首可播的下一首
  const fetchNext = useCallback(async () => {
    try {
      const res = await fetch('/api/next');
      const data = await res.json();
      if (data.next) {
        setCurrentTrack({ ...data.next, reason: data.next.reason, segue: null });
      }
    } catch (err) {
      console.warn('[Player] 自动切歌失败:', err);
    }
  }, []);

  // 计划在后端可能存成 JSON 字符串，统一解析成 { plan, moments }
  const normalizePlan = useCallback((p) => {
    if (!p) return null;
    if (typeof p === 'string') {
      try { return JSON.parse(p); } catch { return { plan: p, moments: [] }; }
    }
    return p;
  }, []);

  // 今日计划：挂载时读取，WS plan_ready 时实时更新
  useEffect(() => {
    fetch('/api/plan/today')
      .then((r) => r.json())
      .then((d) => setPlan(normalizePlan(d.plan)))
      .catch(() => {});
  }, [normalizePlan]);

  // 消费 WS 事件信封（track_change / plan_ready / morning_checkin / mood_check）
  useEffect(() => {
    if (!lastMessage) return;
    const { event, data } = lastMessage;
    if (event === 'track_change') {
      // 本端发起的请求已通过 POST 响应更新过；这里同步状态并避免重复播放旁白
      if (data?.play) setCurrentTrack({ ...data.play, reason: data.reason, segue: data.segue });
      if (data?.tts && data.tts !== announceRef.current) setAnnounceUrl(data.tts);
    } else if (event === 'plan_ready') {
      setPlan(normalizePlan(data));
    } else if (event === 'morning_checkin') {
      setMessages((prev) => [...prev, { role: 'system', content: data?.message || '早安，Wind Sleep 为你准备了今天的早间音乐。' }]);
    } else if (event === 'mood_check') {
      setMoodHint(`🕐 ${data?.hour ?? new Date().getHours()}:00 — 此刻心情如何？告诉我，我来选歌`);
    }
  }, [lastMessage, normalizePlan]);

  const sendMessage = useCallback(async (msg) => {
    if (!msg.trim()) return;
    setLoading(true);
    setMessages((prev) => [...prev, { role: 'user', content: msg }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();

      setMessages((prev) => [...prev, { role: 'assistant', content: data.say }]);

      if (data.play) {
        setCurrentTrack({ ...data.play, reason: data.reason, segue: data.segue });
      }
      if (data.tts) {
        setAnnounceUrl(data.tts);
      }
      // DJ 的切歌/停止指令
      if (data.action === 'next') fetchNext();
      if (data.action === 'stop') {
        audioRef.current?.stop();
        setCurrentTrack(null);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'system', content: '连接失败，请确认服务已启动' }]);
    } finally {
      setLoading(false);
    }
  }, [fetchNext]);

  const handleSubmit = (e) => {
    e.preventDefault();
    audioRef.current?.unlock();
    sendMessage(input);
    setInput('');
  };

  return (
    <div style={containerStyle}>
      <NowPlaying track={currentTrack} />
      <AudioPlayer
        ref={audioRef}
        track={currentTrack}
        announceUrl={announceUrl}
        onPlayError={handlePlayError}
        onTrackEnded={fetchNext}
      />
      {plan && (
        <div style={planCardStyle}>
          <h3 style={planTitleStyle}>📅 今日计划</h3>
          <p style={planTextStyle}>{plan.plan}</p>
          {Array.isArray(plan.moments) && plan.moments.length > 0 && (
            <ul style={planListStyle}>
              {plan.moments.map((m, i) => (
                <li key={i} style={planItemStyle}>
                  <strong>{m.time}</strong> · {m.mood} — {m.suggestion}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <ChatStream messages={messages} loading={loading} />
      <form onSubmit={handleSubmit} style={formStyle}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入消息，或 /play 歌名 直接点歌..."
          style={inputStyle}
          disabled={loading}
        />
        <button type="submit" style={btnStyle} disabled={loading}>
          {loading ? '...' : '发送'}
        </button>
      </form>
      <div style={statusLineStyle}>
        {connected ? '🟢 实时推送已连接' : '🔴 推送断开，重连中...'}
        {moodHint && <span style={{ marginLeft: '12px', color: '#7c8cf8' }}>{moodHint}</span>}
      </div>
    </div>
  );
}

const containerStyle = {
  maxWidth: '640px', margin: '0 auto', padding: '20px',
  display: 'flex', flexDirection: 'column', gap: '20px', minHeight: 'calc(100vh - 60px)',
};
const formStyle = { display: 'flex', gap: '8px', padding: '12px 0' };
const inputStyle = {
  flex: 1, padding: '12px 16px', borderRadius: '12px', border: '1px solid #2a2a4a',
  background: '#1a1a30', color: '#e0e0e0', fontSize: '14px', outline: 'none',
};
const btnStyle = {
  padding: '12px 24px', borderRadius: '12px', border: 'none', background: '#7c8cf8',
  color: '#fff', fontSize: '14px', cursor: 'pointer', fontWeight: 600,
};
const planCardStyle = {
  background: '#14142a', borderRadius: '12px', padding: '14px 16px',
  border: '1px solid #2a2a4a', fontSize: '13px', color: '#999',
};
const planTitleStyle = { fontSize: '14px', fontWeight: 600, color: '#c0c8ff', marginBottom: '6px' };
const planTextStyle = { marginBottom: '6px', whiteSpace: 'pre-wrap' };
const planListStyle = { margin: '0', paddingLeft: '18px' };
const planItemStyle = { marginBottom: '4px' };
const statusLineStyle = { fontSize: '12px', color: '#555', textAlign: 'center' };
