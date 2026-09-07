import { useEffect, useRef, useState } from 'react';

export default function useWebSocket() {
  const [lastMessage, setLastMessage] = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${location.host}/stream`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (e) => {
      try {
        setLastMessage(JSON.parse(e.data));
      } catch {}
    };

    return () => ws.close();
  }, []);

  return { lastMessage, connected };
}
