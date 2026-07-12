import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_GRID_SIZE } from '../game/constants';
import type { DeathEvent, Dir, GameState, GridSize, ServerMessage } from '../types/game';

const OPPOSITE_DIRECTIONS: Record<Dir, Dir> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

function createDeathId(victim: string) {
  return `${victim}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function useGameConnection() {
  const socketRef = useRef<WebSocket | null>(null);
  const playerIdRef = useRef<string | null>(null);
  const deathTimersRef = useRef<Set<number>>(new Set());
  const lastDirectionRef = useRef<Dir>('right');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [gridSize, setGridSize] = useState<GridSize>(DEFAULT_GRID_SIZE);
  const [joined, setJoined] = useState(false);
  const [deaths, setDeaths] = useState<DeathEvent[]>([]);
  const [isDead, setIsDead] = useState(false);

  const addDeath = useCallback((death: Omit<DeathEvent, 'id'>) => {
    const item = { ...death, id: createDeathId(death.victim) };
    setDeaths((current) => [...current.slice(-4), item]);

    const timer = window.setTimeout(() => {
      setDeaths((current) => current.filter((entry) => entry.id !== item.id));
      deathTimersRef.current.delete(timer);
    }, 3000);
    deathTimersRef.current.add(timer);
  }, []);

  const connect = useCallback((playerName?: string) => {
    if (
      socketRef.current?.readyState === WebSocket.OPEN ||
      socketRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/snake/ws`);
    socketRef.current = socket;

    socket.onopen = () => {
      const savedToken = localStorage.getItem('snake_token');
      if (savedToken && playerName === undefined) {
        localStorage.removeItem('snake_token');
        localStorage.removeItem('snake_playerId');
        socket.send(JSON.stringify({ type: 'rejoin', token: savedToken }));
        return;
      }

      socket.send(JSON.stringify({ type: 'join', playerName: playerName?.trim() || '匿名蛇' }));
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as ServerMessage;

      if (message.type === 'welcome') {
        playerIdRef.current = message.playerId;
        setPlayerId(message.playerId);
        setGridSize({ w: message.gridWidth, h: message.gridHeight });
        setJoined(true);
        setIsDead(false);
        localStorage.setItem('snake_playerId', message.playerId);
        if (message.reconnectToken) localStorage.setItem('snake_token', message.reconnectToken);
        return;
      }

      if (message.type === 'gameState') {
        setGameState({ players: message.players, foods: message.foods, scores: message.scores });
        return;
      }

      if (message.type === 'playerDied') {
        addDeath({
          victim: message.victim,
          victimName: message.victimName,
          killer: message.killer,
          killerName: message.killerName,
        });
        return;
      }

      if (message.type === 'youDied') {
        setIsDead(true);
        addDeath({
          victim: playerIdRef.current || 'you',
          victimName: '你',
          killer: null,
          killerName: message.killerName,
        });
      }
    };

    socket.onclose = () => {
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [addDeath]);

  const disconnect = useCallback(() => {
    const socket = socketRef.current;
    socketRef.current = null;
    if (!socket) return;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.close();
  }, []);

  useEffect(() => {
    if (localStorage.getItem('snake_token')) connect();

    return () => {
      disconnect();
      deathTimersRef.current.forEach(window.clearTimeout);
      deathTimersRef.current.clear();
    };
  }, [connect, disconnect]);

  const sendDirection = useCallback((direction: Dir) => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return;
    if (lastDirectionRef.current === OPPOSITE_DIRECTIONS[direction]) return;

    socket.send(JSON.stringify({ type: 'direction', dir: direction }));
    lastDirectionRef.current = direction;
  }, []);

  const respawn = useCallback(() => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return;

    socket.send(JSON.stringify({ type: 'respawn' }));
    setIsDead(false);
    lastDirectionRef.current = 'right';
  }, []);

  const sortedScores = useMemo(
    () => Object.entries(gameState?.scores ?? {}).sort((left, right) => right[1].score - left[1].score),
    [gameState?.scores],
  );
  const myScore = playerId ? gameState?.scores[playerId]?.score ?? 0 : 0;

  return {
    gameState,
    playerId,
    gridSize,
    joined,
    deaths,
    isDead,
    myScore,
    sortedScores,
    connect,
    respawn,
    sendDirection,
  };
}
