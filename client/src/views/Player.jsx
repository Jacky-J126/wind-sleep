import { useState, useCallback, useRef } from 'react';
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
  const { lastMessage } = useWebSocket();
  const audioRef = useRef(null);
  const playErrorShown = useRef(false);

  const handlePlayError = useCallback(() => {
    if (playErrorShown.current) return;
    playErrorShown.current = true;
    setMessages((prev) => [...prev, { role: 'system', content: '播放被浏览器拦截了，点一下页面任意位置即可恢复声音。' }]);
  }, []);

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
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'system', content: '连接失败，请确认服务已启动' }]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    audioRef.current?.unlock();
    sendMessage(input);
    setInput('');
  };

  return (
    <div style={containerStyle}>
      <NowPlaying track={currentTrack} />
      <AudioPlayer ref={audioRef} track={currentTrack} announceUrl={announceUrl} onPlayError={handlePlayError} />
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
