import { useState } from 'react';

export default function Settings() {
  const [volume, setVolume] = useState(() => localStorage.getItem('ws_volume') || '0.8');
  const [status, setStatus] = useState(null);

  const saveVolume = (v) => {
    setVolume(v);
    localStorage.setItem('ws_volume', String(v));
  };

  const clearCache = async () => {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      setStatus('缓存已清除');
      setTimeout(() => setStatus(null), 2000);
    }
  };

  return (
    <div style={containerStyle}>
      <h2 style={titleStyle}>⚙️ 设置</h2>

      <div style={cardStyle}>
        <label style={labelStyle}>音量</label>
        <input
          type="range" min="0" max="1" step="0.05" value={volume}
          onChange={(e) => saveVolume(e.target.value)}
          style={{ width: '100%' }}
        />
        <span style={valStyle}>{Math.round(volume * 100)}%</span>
      </div>

      <div style={cardStyle}>
        <h3 style={labelStyle}>模型</h3>
        <p style={descStyle}>当前使用 Claude Code (claude -p --output json)</p>
        <p style={descStyle}>通过 Max 订阅，无需额外 API key</p>
      </div>

      <div style={cardStyle}>
        <h3 style={labelStyle}>TTS 语音</h3>
        <p style={descStyle}>Fish Audio · {process.env.FISH_AUDIO_KEY ? '已配置' : '未配置 (使用静音占位)'}</p>
      </div>

      <div style={cardStyle}>
        <h3 style={labelStyle}>缓存管理</h3>
        <button onClick={clearCache} style={btnStyle}>清除所有缓存</button>
        {status && <span style={valStyle}>{status}</span>}
      </div>

      <div style={cardStyle}>
        <h3 style={labelStyle}>NeteaseCloudMusicApi</h3>
        <p style={descStyle}>默认连接 http://localhost:3000</p>
        <p style={descStyle}>请确保 NCM API 服务已启动</p>
      </div>
    </div>
  );
}

const containerStyle = { maxWidth: '640px', margin: '0 auto', padding: '20px' };
const titleStyle = { fontSize: '20px', marginBottom: '16px', color: '#c0c8ff' };
const cardStyle = {
  background: '#1a1a30', borderRadius: '12px', padding: '16px', marginBottom: '12px',
  border: '1px solid #2a2a4a',
};
const labelStyle = { fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: '#ccc' };
const descStyle = { fontSize: '13px', color: '#888', marginBottom: '4px' };
const valStyle = { fontSize: '13px', color: '#7c8cf8', marginLeft: '8px' };
const btnStyle = {
  padding: '8px 20px', borderRadius: '8px', border: '1px solid #4a3a4a',
  background: 'transparent', color: '#e0e0e0', cursor: 'pointer', fontSize: '13px',
};
