import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { createGameServer } from './index.js';

async function start(t, reconnectMs = 80, options = {}) {
  const instance = createGameServer({ tickMs: 10000, reconnectMs, ...options });
  t.after(() => instance.close());
  instance.wss.on('error', () => {});
  instance.server.listen(0, '127.0.0.1');
  await once(instance.server, 'listening');
  const url = `ws://127.0.0.1:${instance.server.address().port}/snake/ws`;
  async function connect() {
    const socket = new WebSocket(url);
    const queue = [];
    let wake;
    socket.on('message', data => {
      queue.push(JSON.parse(data.toString()));
      wake?.();
    });
    socket.on('error', () => {});
    await once(socket, 'open');
    const next = async type => {
      const deadline = Date.now() + 1500;
      while (Date.now() < deadline) {
        const index = queue.findIndex(message => message.type === type);
        if (index >= 0) return queue.splice(index, 1)[0];
        await new Promise(resolve => {
          const timer = setTimeout(resolve, Math.max(1, deadline - Date.now()));
          wake = () => { clearTimeout(timer); wake = null; resolve(); };
        });
      }
      throw new Error(`Timed out waiting for ${type}`);
    };
    const send = message => socket.send(JSON.stringify(message));
    return { socket, next, send };
  }
  return { ...instance, connect };
}

async function disconnect(client, code = 1000) {
  const closed = once(client.socket, 'close');
  client.socket.close(code);
  await closed;
}

test('connected session tokens stay usable beyond the reconnect grace duration', async t => {
  const server = await start(t);
  const first = await server.connect();
  first.send({ type: 'join', playerName: 'Long session' });
  const initial = await first.next('welcome');
  await delay(120);
  await disconnect(first);
  const second = await server.connect();
  second.send({ type: 'rejoin', token: initial.reconnectToken });
  const resumed = await second.next('welcome');
  assert.equal(resumed.playerId, initial.playerId);
  assert.notEqual(resumed.reconnectToken, initial.reconnectToken);
  await delay(120); // The first socket's cleanup cannot remove this player.
  assert.ok(server.game.players.has(initial.playerId));
  second.send({ type: 'direction', dir: 'up' });
  await delay(20);
  assert.deepEqual(server.game.players.get(initial.playerId).turns, ['up']);
});

test('dead rejoin stays dead and only explicit respawn revives the player', async t => {
  const server = await start(t, 300);
  const first = await server.connect();
  first.send({ type: 'join', playerName: 'Dead session' });
  const initial = await first.next('welcome');
  const player = server.game.players.get(initial.playerId);
  player.alive = false;
  player.snake = [];
  player.score = 35;
  await disconnect(first);
  const second = await server.connect();
  await second.next('gameState'); // Spectator snapshot before rejoin.
  second.send({ type: 'rejoin', token: initial.reconnectToken });
  const resumed = await second.next('welcome');
  assert.equal(resumed.alive, false);
  assert.equal(resumed.score, 35);
  const deadState = await second.next('gameState');
  assert.equal(deadState.players.find(p => p.id === resumed.playerId).alive, false);
  second.send({ type: 'respawn' });
  const revivedState = await second.next('gameState');
  const revived = revivedState.players.find(p => p.id === resumed.playerId);
  assert.equal(revived.alive, true);
  assert.equal(revived.snake.length, 3);
  assert.equal(revivedState.scores[resumed.playerId].score, 35);
});

test('resumed sessions can disconnect and reconnect again with their new token', async t => {
  const server = await start(t, 300);
  const first = await server.connect();
  first.send({ type: 'join', playerName: 'Repeated reconnect' });
  const initial = await first.next('welcome');
  await disconnect(first);
  const second = await server.connect();
  second.send({ type: 'rejoin', token: initial.reconnectToken });
  const resumed = await second.next('welcome');
  await disconnect(second);
  const third = await server.connect();
  third.send({ type: 'rejoin', token: resumed.reconnectToken });
  assert.equal((await third.next('welcome')).playerId, initial.playerId);
});

test('replacing a live socket ignores its later close and rotates the token', async t => {
  const server = await start(t);
  const first = await server.connect();
  first.send({ type: 'join', playerName: 'Handoff' });
  const initial = await first.next('welcome');
  const staleSocket = [...server.wss.clients][0];
  const second = await server.connect();
  const oldClosed = once(first.socket, 'close');
  second.send({ type: 'rejoin', token: initial.reconnectToken });
  const resumed = await second.next('welcome');
  await oldClosed;
  // A previously queued callback on the old transport must not control the
  // resumed session, even if it is delivered after the handoff.
  staleSocket.emit('message', Buffer.from(JSON.stringify({ type: 'direction', dir: 'up' })));
  assert.deepEqual(server.game.players.get(initial.playerId).turns, []);
  await delay(120);
  assert.ok(server.game.players.has(initial.playerId));
  const third = await server.connect();
  third.send({ type: 'rejoin', token: initial.reconnectToken });
  assert.equal((await third.next('error')).code, 'invalid_token');
  second.send({ type: 'join', playerName: 'Duplicate' });
  assert.equal((await second.next('welcome')).playerId, resumed.playerId);
  assert.equal(server.game.players.size, 1);
});

test('expired tokens reject explicitly, remove the session, and permit a fresh join', async t => {
  const server = await start(t);
  const first = await server.connect();
  first.send({ type: 'join', playerName: 123 });
  const initial = await first.next('welcome');
  assert.equal(server.game.players.get(initial.playerId).name, 'Player');
  await disconnect(first);
  await delay(120);
  assert.equal(server.game.players.has(initial.playerId), false);
  const second = await server.connect();
  second.send({ type: 'rejoin', token: initial.reconnectToken });
  assert.equal((await second.next('error')).code, 'invalid_token');
  second.send({ type: 'join', playerName: 'Fresh' });
  assert.notEqual((await second.next('welcome')).playerId, initial.playerId);
});

test('idle snapshots keep the connection alive without advancing game simulation', async t => {
  const server = await start(t, 300, { tickMs: 10, idleStateMs: 40 });
  const client = await server.connect();
  const initial = await client.next('gameState');
  const heartbeat = await client.next('gameState');
  assert.equal(heartbeat.seq, initial.seq);
  assert.deepEqual(heartbeat.players, []);
  assert.deepEqual(heartbeat.foods, initial.foods);
});

test('disconnect freezes the snake until the session is resumed', async t => {
  const server = await start(t);
  const first = await server.connect();
  first.send({ type: 'join', playerName: 'Frozen' });
  const initial = await first.next('welcome');
  const before = structuredClone(server.game.players.get(initial.playerId).snake[0]);
  await disconnect(first);
  const parked = server.game.players.get(initial.playerId);
  assert.equal(parked.frozen, true);
  server.game.tick();
  server.game.tick();
  assert.deepEqual(parked.snake[0], before);
  assert.equal(parked.alive, true);
  const second = await server.connect();
  second.send({ type: 'rejoin', token: initial.reconnectToken });
  await second.next('welcome');
  assert.equal(server.game.players.get(initial.playerId).frozen, false);
  const resumedHead = structuredClone(server.game.players.get(initial.playerId).snake[0]);
  server.game.tick();
  assert.notDeepEqual(server.game.players.get(initial.playerId).snake[0], resumedHead);
});

test('observers hear wall deaths as collisions without kill credit', async t => {
  const server = await start(t);
  const victim = await server.connect();
  victim.send({ type: 'join', playerName: 'Wall' });
  const welcome = await victim.next('welcome');
  const observer = await server.connect();
  observer.send({ type: 'join', playerName: 'Watcher' });
  await observer.next('welcome');
  const player = server.game.players.get(welcome.playerId);
  player.snake = [{ x: 59, y: 5 }, { x: 58, y: 5 }, { x: 57, y: 5 }];
  player.dir = 'right';
  player.turns = [];
  server.step();
  const died = await observer.next('playerDied');
  assert.equal(died.victim, welcome.playerId);
  assert.equal(died.killer, null);
  assert.equal(died.cause, 'wall');
  assert.equal(died.scoringKill, false);
  assert.equal((await victim.next('youDied')).cause, 'wall');
});

test('intentional leave removes the snake immediately and invalidates its token', async t => {
  const server = await start(t, 1000);
  const first = await server.connect();
  first.send({ type: 'join', playerName: 'Leaving' });
  const initial = await first.next('welcome');
  await disconnect(first, 4001);
  const second = await server.connect();
  const state = await second.next('gameState');
  assert.equal(state.players.some(player => player.id === initial.playerId), false);
  assert.equal(server.game.players.has(initial.playerId), false);
  second.send({ type: 'rejoin', token: initial.reconnectToken });
  assert.equal((await second.next('error')).code, 'invalid_token');
});
