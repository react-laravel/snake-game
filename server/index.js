import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createGame } from './game.js';

const clientDist = resolve(dirname(fileURLToPath(import.meta.url)), '../client/dist');
const STATE_BUFFER_LIMIT = 64 * 1024;
const CONNECTION_BUFFER_LIMIT = 1024 * 1024;

export function createGameServer({ tickMs = 150, reconnectMs = 30000, idleStateMs = 5000, game = createGame() } = {}) {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server, path: '/snake/ws', maxPayload: 1024 });
  const sessions = new Map();
  const tokens = new Map();
  let closing = false;
  let lastStateBroadcastAt = Date.now();

  app.use(express.static(clientDist));
  app.use('/snake', express.static(clientDist));
  app.get('/health', (_, res) => res.json({ ok: true }));

  function send(socket, data, isState = false) {
    if (socket.readyState !== WebSocket.OPEN) return;
    if (socket.bufferedAmount > CONNECTION_BUFFER_LIMIT) {
      socket.terminate();
      return;
    }
    if (isState && socket.bufferedAmount > STATE_BUFFER_LIMIT) return;
    socket.send(data);
  }

  function broadcast(message, excludePlayerId, isState = false) {
    const data = JSON.stringify(message);
    for (const socket of wss.clients) {
      if (excludePlayerId && socket.playerId === excludePlayerId) continue;
      send(socket, data, isState);
    }
  }

  function sendState(socket) {
    send(socket, JSON.stringify(game.state(tickMs)), true);
  }

  function broadcastState() {
    broadcast(game.state(tickMs), null, true);
    lastStateBroadcastAt = Date.now();
  }

  function error(socket, code, message) {
    send(socket, JSON.stringify({ type: 'error', code, message }));
  }

  function currentSession(socket) {
    const session = sessions.get(socket.playerId);
    return session?.socket === socket ? session : null;
  }

  function welcome(socket, session) {
    const player = game.players.get(session.playerId);
    send(socket, JSON.stringify({
      type: 'welcome', playerId: player.id, gridWidth: game.width, gridHeight: game.height,
      reconnectToken: session.token, alive: player.alive, dir: player.dir, score: player.score, tickMs,
    }));
    sendState(socket);
  }

  function attach(socket, session) {
    const previousSocket = session.socket;
    clearTimeout(session.cleanupTimer);
    tokens.delete(session.token);
    session.token = randomBytes(24).toString('base64url');
    session.socket = socket;
    session.expiresAt = Infinity;
    session.cleanupTimer = null;
    tokens.set(session.token, session.playerId);
    socket.playerId = session.playerId;
    // Identity checks on every message/close keep a replaced socket from
    // controlling or deleting the newly resumed player.
    if (previousSocket && previousSocket !== socket) previousSocket.close(1000, 'Session resumed elsewhere');
    welcome(socket, session);
  }

  function removeSession(session) {
    clearTimeout(session.cleanupTimer);
    tokens.delete(session.token);
    sessions.delete(session.playerId);
    game.removePlayer(session.playerId);
    broadcastState();
  }

  wss.on('connection', socket => {
    socket.isAlive = true;
    socket.on('pong', () => { socket.isAlive = true; });
    // A socket error is followed by close; close owns session cleanup.
    socket.on('error', () => {});
    sendState(socket);

    socket.on('message', data => {
      let message;
      try { message = JSON.parse(data.toString()); } catch {
        error(socket, 'invalid_message', '消息格式无效');
        return;
      }
      if (!message || typeof message !== 'object' || Array.isArray(message)) return;
      const session = currentSession(socket);

      if (message.type === 'join') {
        if (session) {
          welcome(socket, session); // Repeated join cannot reset a player's score.
          return;
        }
        if (socket.playerId) return;
        const name = typeof message.playerName === 'string' ? message.playerName.trim().slice(0, 20) : '';
        const player = game.addPlayer(name || 'Player');
        if (!player) {
          error(socket, 'arena_full', '场地已满，请稍后再试');
          return;
        }
        const newSession = { playerId: player.id, socket: null, token: null, expiresAt: Infinity, cleanupTimer: null };
        sessions.set(player.id, newSession);
        attach(socket, newSession);
        return;
      }

      if (message.type === 'rejoin') {
        if (session) {
          welcome(socket, session);
          return;
        }
        if (socket.playerId) return;
        const id = typeof message.token === 'string' ? tokens.get(message.token) : undefined;
        const savedSession = sessions.get(id);
        if (!savedSession || savedSession.expiresAt <= Date.now() || !game.players.has(id)) {
          error(socket, 'invalid_token', '连接已过期，请重新加入');
          return;
        }
        attach(socket, savedSession);
        return;
      }

      if (!session) return;
      if (message.type === 'direction') game.setDirection(session.playerId, message.dir);
      if (message.type === 'respawn') {
        if (!game.respawn(session.playerId)) error(socket, 'arena_full', '场地已满，请稍后再试');
        else sendState(socket);
      }
    });

    socket.on('close', code => {
      if (closing) return;
      const session = currentSession(socket);
      if (!session) return;
      if (code === 4001) {
        removeSession(session);
        return;
      }
      session.socket = null;
      session.expiresAt = Date.now() + reconnectMs;
      session.cleanupTimer = setTimeout(() => {
        if (!session.socket && session.expiresAt <= Date.now()) removeSession(session);
      }, reconnectMs);
      session.cleanupTimer.unref();
    });
  });

  const tickTimer = setInterval(() => {
    if (![...game.players.values()].some(player => player.alive)) {
      // Browsers cannot observe WebSocket ping/pong frames. A sparse snapshot
      // keeps their connection watchdog alive while the arena is idle.
      if (wss.clients.size && Date.now() - lastStateBroadcastAt >= idleStateMs) broadcastState();
      return;
    }
    for (const { victim, killer } of game.tick()) {
      if (killer) broadcast({
        type: 'playerDied', victim: victim.id, victimName: victim.name, killer: killer.id, killerName: killer.name,
      }, victim.id);
      const socket = sessions.get(victim.id)?.socket;
      if (socket) send(socket, JSON.stringify({ type: 'youDied', killerName: killer?.name || null }));
    }
    broadcastState();
  }, tickMs);

  const heartbeatTimer = setInterval(() => {
    for (const socket of wss.clients) {
      if (!socket.isAlive) socket.terminate();
      else {
        socket.isAlive = false;
        if (socket.readyState === WebSocket.OPEN) socket.ping();
      }
    }
  }, 15000);
  heartbeatTimer.unref();

  async function close() {
    closing = true;
    clearInterval(tickTimer);
    clearInterval(heartbeatTimer);
    for (const session of sessions.values()) clearTimeout(session.cleanupTimer);
    for (const socket of wss.clients) socket.terminate();
    await new Promise(resolveClose => wss.close(resolveClose));
    if (server.listening) await new Promise(resolveClose => server.close(resolveClose));
  }

  return { server, wss, game, close };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { server } = createGameServer();
  const port = process.env.PORT || 3333;
  server.listen(port, '0.0.0.0', () => console.log(`Snake server running on port ${port}`));
}
