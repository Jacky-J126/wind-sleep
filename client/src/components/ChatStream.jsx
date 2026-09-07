import { useEffect, useRef } from 'react';

export default function ChatStream({ messages, loading }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div style={containerStyle}>
      {messages.length === 0 && (
        <div style={{ textAlign: 'center', color: '#444', padding: '20px', fontSize: '13px' }}>
          对话将在这里显示
        </div>
      )}
      {messages.map((msg, i) => (
        <div key={i} style={{
          ...msgStyle,
          alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
          background: msg.role === 'user' ? '#2a2a5a' : msg.role === 'system' ? '#3a2a2a' : '#1a1a30',
        }}>
          {msg.content}
        </div>
      ))}
      {loading && (
        <div style={{ ...msgStyle, alignSelf: 'flex-start', background: '#1a1a30', opacity: 0.6 }}>
          Wind Sleep 正在思考...
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

const containerStyle = {
  flex: 1, display: 'flex', flexDirection: 'column', gap: '8px',
  padding: '0 0 12px', overflow: 'auto', minHeight: '200px', maxHeight: '400px',
};
const msgStyle = {
  maxWidth: '80%', padding: '10px 14px', borderRadius: '12px',
  fontSize: '14px', lineHeight: 1.5, color: '#d0d0d0',
};
