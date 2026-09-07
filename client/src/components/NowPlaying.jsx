export default function NowPlaying({ track }) {
  if (!track) {
    return (
      <div style={containerStyle}>
        <div style={placeholderStyle}>
          <span style={{ fontSize: '48px' }}>🌬️</span>
          <p style={{ marginTop: '12px', color: '#555' }}>Wind Sleep 待命中...</p>
          <p style={{ fontSize: '12px', color: '#444' }}>
            发送消息告诉我你的心情，或 /play 歌名 直接点歌
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={artStyle}>🎵</div>
      <h2 style={songStyle}>{track.name}</h2>
      <p style={artistStyle}>{track.artist}</p>
      {track.reason && <p style={reasonStyle}>💡 {track.reason}</p>}
      {track.segue && <p style={segueStyle}>🎙️ {track.segue}</p>}
    </div>
  );
}

const containerStyle = {
  textAlign: 'center', padding: '40px 20px 20px',
  background: 'linear-gradient(180deg, #1a1a30 0%, #0f0f1a 100%)',
  borderRadius: '16px', border: '1px solid #2a2a4a',
};
const placeholderStyle = { padding: '20px' };
const artStyle = { fontSize: '64px', marginBottom: '12px' };
const songStyle = { fontSize: '22px', color: '#e0e0e0', marginBottom: '4px' };
const artistStyle = { fontSize: '15px', color: '#999', marginBottom: '12px' };
const reasonStyle = { fontSize: '13px', color: '#7c8cf8', marginTop: '8px' };
const segueStyle = { fontSize: '12px', color: '#666', marginTop: '4px', fontStyle: 'italic' };
