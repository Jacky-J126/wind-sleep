import { useEffect, useRef, useState } from 'react';

// WebSocket 长连接：自动重连（3s 退避），消息为统一信封 { event, data, ts }
export default function useWebSocket() {
  const [lastMessage, setLastMessage] = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    let closed = false;
    let retryTimer = null;

    const connect = () => {
      if (closed) return;
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${location.host}/stream`);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retryTimer = setTimeout(connect, 3000);
      };
      ws.onmessage = (e) => {
        try {
          setLastMessage(JSON.parse(e.data));
        } catch {
          // 忽略无法解析的消息
        }
      };
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retryTimer);
      wsRef.current?.close();
    };
  }, []);

  return { lastMessage, connected };
}
