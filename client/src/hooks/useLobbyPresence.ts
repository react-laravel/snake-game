import { useEffect, useState } from 'react';
import { parseServerMessage } from './connectionUtils';

export interface ArenaPresence {
  total: number;
  alive: number;
  linked: boolean;
}

export function useLobbyPresence(active: boolean) {
  const [presence, setPresence] = useState<ArenaPresence>({ total: 0, alive: 0, linked: false });

  useEffect(() => {
    if (!active) {
      setPresence({ total: 0, alive: 0, linked: false });
      return;
    }
    let closed = false;
    let socket: WebSocket;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${window.location.host}/snake/ws`);
    } catch {
      return;
    }

    socket.onopen = () => {
      if (!closed) setPresence((current) => ({ ...current, linked: true }));
    };
    socket.onmessage = (event) => {
      const message = parseServerMessage(event.data);
      if (message?.type !== 'gameState') return;
      const scores = Object.values(message.scores);
      setPresence({
        total: scores.length,
        alive: scores.filter((entry) => entry.alive).length,
        linked: true,
      });
    };
    socket.onclose = () => {
      if (!closed) setPresence((current) => ({ ...current, linked: false }));
    };

    return () => {
      closed = true;
      socket.close();
    };
  }, [active]);

  return presence;
}
