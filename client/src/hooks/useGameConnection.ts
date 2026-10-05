import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_GRID_SIZE } from '../game/constants';
import type { ConnectionStatus, DeathEvent, Dir, GameState, GridSize } from '../types/game';
import { MAX_RECONNECT_ATTEMPTS, parseServerMessage, readStored, reconnectDelay, reuseScores, writeStored } from './connectionUtils';

const HANDSHAKE_TIMEOUT_MS = 8000;
const SILENCE_TIMEOUT_MS = 15000;
const RESPAWN_TIMEOUT_MS = 6000;

function storedName() {
  return (readStored('snake_name') ?? readStored('snake_playerName'))?.trim().slice(0, 20) || '匿名蛇';
}

function createDeathId(victim: string) {
  return `${victim}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function clearTimer(ref: { current: number | null }) {
  if (ref.current !== null) window.clearTimeout(ref.current);
  ref.current = null;
}

export function useGameConnection() {
  const socketRef = useRef<WebSocket | null>(null);
  const authenticatedSocketRef = useRef(false);
  const failureRef = useRef<((reason: string) => void) | null>(null);
  const playerIdRef = useRef<string | null>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const deathTimersRef = useRef<Set<number>>(new Set());
  const handshakeTimerRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const respawnTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const tokenRef = useRef<string | null>(null);
  const nameRef = useRef('匿名蛇');
  const lastMessageAtRef = useRef(0);
  const desiredConnectionRef = useRef(false);
  const mountedRef = useRef(false);
  const deadRef = useRef(false);
  const respawningRef = useRef(false);
  const startSocketRef = useRef<(reconnecting: boolean) => void>(() => {});
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [gridSize, setGridSize] = useState<GridSize>(DEFAULT_GRID_SIZE);
  const [joined, setJoined] = useState(false);
  const [deaths, setDeaths] = useState<DeathEvent[]>([]);
  const [isDead, setIsDead] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [respawning, setRespawning] = useState(false);

  const finishRespawn = useCallback(() => {
    clearTimer(respawnTimerRef);
    respawningRef.current = false;
    setRespawning(false);
  }, []);

  const detachSocket = useCallback((code = 1000, reason = '') => {
    clearTimer(handshakeTimerRef);
    const socket = socketRef.current;
    socketRef.current = null;
    authenticatedSocketRef.current = false;
    failureRef.current = null;
    if (!socket) return;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.onerror = null;
    socket.close(code, reason);
  }, []);

  const addDeath = useCallback((death: Omit<DeathEvent, 'id'>) => {
    const item = { ...death, id: createDeathId(death.victim) };
    setDeaths((current) => [...current.slice(-4), item]);
    const timer = window.setTimeout(() => {
      setDeaths((current) => current.filter((entry) => entry.id !== item.id));
      deathTimersRef.current.delete(timer);
    }, 3000);
    deathTimersRef.current.add(timer);
  }, []);

  const startSocket = useCallback((reconnecting: boolean) => {
    if (!mountedRef.current || !desiredConnectionRef.current) return;
    detachSocket();
    finishRespawn();
    setConnectionStatus(reconnecting ? 'reconnecting' : 'connecting');
    setConnectionError(null);
    let socket: WebSocket;
    let waitingForWelcome = true;
    let requestedRejoin = false;

    const handleFailure = (reason: string, canRetry = true) => {
      if (!mountedRef.current || !desiredConnectionRef.current || socketRef.current !== socket) return;
      detachSocket();
      finishRespawn();
      if (!canRetry || reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
        setConnectionStatus('error');
        setConnectionError(canRetry ? '多次连接未成功，请稍后重试。' : reason);
        return;
      }
      setConnectionError(reason);
      setConnectionStatus('reconnecting');
      const delay = reconnectDelay(reconnectAttemptRef.current++);
      clearTimer(reconnectTimerRef);
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        startSocketRef.current(true);
      }, delay);
    };

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${window.location.host}/snake/ws`);
      socketRef.current = socket;
      failureRef.current = handleFailure;
    } catch {
      // Construction can fail before a WebSocket exists (for example blocked URLs).
      setConnectionStatus('error');
      setConnectionError('无法建立连接，请稍后重试。');
      return;
    }

    const armHandshakeTimeout = () => {
      clearTimer(handshakeTimerRef);
      handshakeTimerRef.current = window.setTimeout(() => {
        handleFailure('连接超时，正在尝试重新连接。');
      }, HANDSHAKE_TIMEOUT_MS);
    };
    const send = (message: object) => {
      if (socketRef.current !== socket || socket.readyState !== WebSocket.OPEN) return false;
      try {
        socket.send(JSON.stringify(message));
        return true;
      } catch {
        handleFailure('连接已中断，正在尝试重新连接。');
        return false;
      }
    };

    armHandshakeTimeout();
    socket.onopen = () => {
      if (socketRef.current !== socket) return;
      lastMessageAtRef.current = Date.now();
      requestedRejoin = Boolean(tokenRef.current);
      if (requestedRejoin) send({ type: 'rejoin', token: tokenRef.current });
      else send({ type: 'join', playerName: nameRef.current });
    };

    socket.onmessage = (event) => {
      if (!mountedRef.current || socketRef.current !== socket || !desiredConnectionRef.current) return;
      const message = parseServerMessage(event.data);
      if (!message) return;
      lastMessageAtRef.current = Date.now();

      if (message.type === 'error') {
        if (waitingForWelcome && requestedRejoin && message.code === 'invalid_token') {
          requestedRejoin = false;
          tokenRef.current = null;
          playerIdRef.current = null;
          gameStateRef.current = null;
          writeStored('snake_token', null);
          writeStored('snake_playerId', null);
          setPlayerId(null);
          setGameState(null);
          armHandshakeTimeout();
          send({ type: 'join', playerName: nameRef.current });
          return;
        }
        const reason = message.code === 'arena_full'
          ? '场地暂时没有安全出生点，请稍后再试。'
          : message.message || '服务器暂时无法处理请求，请重试。';
        if (waitingForWelcome) handleFailure(reason, false);
        else {
          finishRespawn();
          setConnectionError(reason);
        }
        return;
      }

      if (message.type === 'welcome') {
        waitingForWelcome = false;
        authenticatedSocketRef.current = true;
        clearTimer(handshakeTimerRef);
        reconnectAttemptRef.current = 0;
        playerIdRef.current = message.playerId;
        deadRef.current = message.alive === false;
        setPlayerId(message.playerId);
        setGridSize({ w: message.gridWidth, h: message.gridHeight });
        setJoined(true);
        setIsDead(deadRef.current);
        setConnectionStatus('connected');
        setConnectionError(null);
        writeStored('snake_playerId', message.playerId);
        writeStored('snake_name', nameRef.current);
        if (message.reconnectToken) {
          tokenRef.current = message.reconnectToken;
          writeStored('snake_token', message.reconnectToken);
        }
        return;
      }

      if (waitingForWelcome) return;

      if (message.type === 'gameState') {
        const state: GameState = {
          players: message.players,
          foods: message.foods,
          scores: reuseScores(gameStateRef.current?.scores, message.scores),
          seq: message.seq,
          tickMs: message.tickMs,
        };
        gameStateRef.current = state;
        setGameState(state);
        const me = message.players.find((player) => player.id === playerIdRef.current);
        if (me) {
          if (nameRef.current !== me.name) {
            nameRef.current = me.name;
            writeStored('snake_name', me.name);
          }
          if (deadRef.current && me.alive) {
            setConnectionError(null);
          }
          deadRef.current = !me.alive;
          setIsDead(!me.alive);
          if (me.alive && respawningRef.current) finishRespawn();
        }
        return;
      }

      if (message.type === 'playerDied') {
        addDeath({ victim: message.victim, victimName: message.victimName,
          killer: message.killer, killerName: message.killerName });
        return;
      }

      if (message.type === 'youDied') {
        deadRef.current = true;
        setIsDead(true);
        finishRespawn();
        addDeath({ victim: playerIdRef.current || 'you', victimName: '你',
          killer: null, killerName: message.killerName });
      }
    };

    socket.onerror = () => handleFailure('无法连接服务器，正在尝试重新连接。');
    socket.onclose = () => handleFailure('连接已中断，正在尝试重新连接。');
  }, [addDeath, detachSocket, finishRespawn]);

  useEffect(() => {
    startSocketRef.current = startSocket;
  }, [startSocket]);

  const connect = useCallback((playerName?: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN ||
        socketRef.current?.readyState === WebSocket.CONNECTING) return;
    clearTimer(reconnectTimerRef);
    reconnectAttemptRef.current = 0;
    desiredConnectionRef.current = true;
    if (playerName !== undefined) {
      nameRef.current = playerName.trim().slice(0, 20) || '匿名蛇';
      tokenRef.current = null;
      writeStored('snake_token', null);
      writeStored('snake_playerId', null);
      writeStored('snake_name', nameRef.current);
    } else {
      tokenRef.current = tokenRef.current ?? readStored('snake_token');
      nameRef.current = storedName();
    }
    startSocket(false);
  }, [startSocket]);

  const retry = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN && authenticatedSocketRef.current) return;
    clearTimer(reconnectTimerRef);
    reconnectAttemptRef.current = 0;
    desiredConnectionRef.current = true;
    startSocket(Boolean(playerIdRef.current));
  }, [startSocket]);

  const leave = useCallback(() => {
    desiredConnectionRef.current = false;
    clearTimer(reconnectTimerRef);
    detachSocket(4001, 'leave');
    finishRespawn();
    tokenRef.current = null;
    playerIdRef.current = null;
    gameStateRef.current = null;
    deadRef.current = false;
    reconnectAttemptRef.current = 0;
    writeStored('snake_token', null);
    writeStored('snake_playerId', null);
    deathTimersRef.current.forEach(window.clearTimeout);
    deathTimersRef.current.clear();
    setGameState(null);
    setPlayerId(null);
    setGridSize(DEFAULT_GRID_SIZE);
    setJoined(false);
    setIsDead(false);
    setDeaths([]);
    setConnectionStatus('idle');
    setConnectionError(null);
  }, [detachSocket, finishRespawn]);

  useEffect(() => {
    mountedRef.current = true;
    tokenRef.current = readStored('snake_token');
    nameRef.current = storedName();
    if (tokenRef.current) connect();
    const watchdog = window.setInterval(() => {
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN && playerIdRef.current &&
          Date.now() - lastMessageAtRef.current > SILENCE_TIMEOUT_MS) {
        failureRef.current?.('连接长时间没有响应，正在尝试重新连接。');
      }
    }, 3000);
    return () => {
      mountedRef.current = false;
      desiredConnectionRef.current = false;
      clearTimer(reconnectTimerRef);
      clearTimer(respawnTimerRef);
      detachSocket();
      window.clearInterval(watchdog);
      deathTimersRef.current.forEach(window.clearTimeout);
      deathTimersRef.current.clear();
    };
  }, [connect, detachSocket]);

  const sendDirection = useCallback((direction: Dir) => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN || !authenticatedSocketRef.current ||
        !playerIdRef.current || deadRef.current) return;
    try {
      socket.send(JSON.stringify({ type: 'direction', dir: direction }));
    } catch {
      failureRef.current?.('连接已中断，正在尝试重新连接。');
    }
  }, []);

  const respawn = useCallback(() => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN || !authenticatedSocketRef.current ||
        !deadRef.current || respawningRef.current) return;
    try {
      socket.send(JSON.stringify({ type: 'respawn' }));
      respawningRef.current = true;
      setRespawning(true);
      setConnectionError(null);
      respawnTimerRef.current = window.setTimeout(() => {
        respawnTimerRef.current = null;
        respawningRef.current = false;
        setRespawning(false);
        setConnectionError('复活请求暂未确认，请再试一次。');
      }, RESPAWN_TIMEOUT_MS);
    } catch {
      failureRef.current?.('连接已中断，正在尝试重新连接。');
    }
  }, []);

  const sortedScores = useMemo(
    () => Object.entries(gameState?.scores ?? {}).sort((left, right) => right[1].score - left[1].score ||
      left[1].name.localeCompare(right[1].name) || left[0].localeCompare(right[0])),
    [gameState?.scores],
  );
  const myScore = playerId ? gameState?.scores[playerId]?.score ?? 0 : 0;

  return { gameState, gameStateRef, playerId, gridSize, joined, deaths, isDead, myScore, sortedScores,
    connect, respawn, sendDirection, connectionStatus, connectionError, respawning, leave, retry };
}
