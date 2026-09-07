import { useState, useCallback } from 'react';
import Player from './views/Player';
import Profile from './views/Profile';
import Settings from './views/Settings';

const VIEWS = { player: Player, profile: Profile, settings: Settings };

export default function App() {
  const [view, setView] = useState('player');

  const ViewComponent = VIEWS[view];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav style={navStyle}>
        <span style={logoStyle}>🌬️ Wind Sleep</span>
        <div style={tabsStyle}>
          {Object.keys(VIEWS).map((k) => (
            <button key={k} onClick={() => setView(k)} style={{
              ...tabStyle,
              borderBottom: view === k ? '2px solid #7c8cf8' : '2px solid transparent',
              color: view === k ? '#c0c8ff' : '#888',
            }}>
              {{ player: '播放', profile: '品味', settings: '设置' }[k]}
            </button>
          ))}
        </div>
      </nav>
      <main style={{ flex: 1 }}>
        <ViewComponent />
      </main>
    </div>
  );
}

const navStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '12px 20px', background: '#16162a', borderBottom: '1px solid #2a2a4a',
};
const logoStyle = { fontSize: '18px', fontWeight: 600, color: '#c0c8ff' };
const tabsStyle = { display: 'flex', gap: '4px' };
const tabStyle = {
  background: 'none', border: 'none', color: '#888', padding: '8px 16px',
  cursor: 'pointer', fontSize: '14px', transition: 'color 0.2s',
};
