import { useState, useEffect } from 'react';

export default function Profile() {
  const [files, setFiles] = useState({});
  const [editing, setEditing] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    fetch('/api/taste')
      .then((r) => r.json())
      .then((d) => {
        setFiles(d);
        setEditing(d);
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async (name) => {
    setSaving(name);
    try {
      const res = await fetch('/api/taste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: name, content: editing[name] || '' }),
      });
      const data = await res.json();
      if (data.success) {
        setFiles((prev) => ({ ...prev, [name]: editing[name] }));
        setStatus(`${name} 已保存`);
      } else {
        setStatus(`保存失败: ${data.error || '未知错误'}`);
      }
    } catch (err) {
      setStatus('保存失败，请确认服务已启动');
    } finally {
      setSaving(null);
      setTimeout(() => setStatus(null), 2000);
    }
  };

  if (loading) return <div style={containerStyle}>加载中...</div>;

  return (
    <div style={containerStyle}>
      <h2 style={titleStyle}>🎵 我的音乐品味</h2>
      {Object.entries(files).map(([name, content]) => (
        <div key={name} style={cardStyle}>
          <div style={headerStyle}>
            <h3 style={fileTitle}>{name}</h3>
            <button
              onClick={() => save(name)}
              disabled={saving === name}
              style={btnStyle}
            >
              {saving === name ? '保存中...' : '保存'}
            </button>
          </div>
          <textarea
            value={editing[name] || ''}
            onChange={(e) => setEditing((prev) => ({ ...prev, [name]: e.target.value }))}
            style={textareaStyle}
            rows={name === 'playlists.json' ? 8 : 10}
            spellCheck={false}
          />
        </div>
      ))}
      <p style={hintStyle}>改动保存后即时生效，无需重启服务。</p>
      {status && <p style={statusStyle}>{status}</p>}
    </div>
  );
}

const containerStyle = { maxWidth: '640px', margin: '0 auto', padding: '20px' };
const titleStyle = { fontSize: '20px', marginBottom: '16px', color: '#c0c8ff' };
const cardStyle = {
  background: '#1a1a30', borderRadius: '12px', padding: '16px', marginBottom: '12px',
  border: '1px solid #2a2a4a',
};
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' };
const fileTitle = { fontSize: '14px', color: '#7c8cf8', margin: 0 };
const textareaStyle = {
  width: '100%', boxSizing: 'border-box', background: '#0f0f1a', color: '#ccc',
  border: '1px solid #2a2a4a', borderRadius: '8px', padding: '10px', fontSize: '13px',
  lineHeight: 1.6, fontFamily: 'monospace', resize: 'vertical', outline: 'none',
};
const hintStyle = { fontSize: '12px', color: '#555', marginTop: '20px', textAlign: 'center' };
const statusStyle = { fontSize: '13px', color: '#7c8cf8', textAlign: 'center', marginTop: '8px' };
const btnStyle = {
  padding: '6px 18px', borderRadius: '8px', border: 'none', background: '#7c8cf8',
  color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
};
