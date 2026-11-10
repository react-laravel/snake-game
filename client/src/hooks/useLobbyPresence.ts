import { useEffect, useState } from 'react';
import { lobbyRoster, type LobbyPresence } from '../game/lobby';
import { parseServerMessage } from './connectionUtils';

export type ArenaPresence = LobbyPresence;

const EMPTY: LobbyPresence = { total: 0, alive: 0, linked: false, players: [] };

export function useLobbyPresence(active: boolean) {
  const [presence, setPresence] = useState<LobbyPresence>(EMPTY);

  useEffect(() => {
    if (!active) {
      setPresence(EMPTY);
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
        players: lobbyRoster(message.scores),
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
