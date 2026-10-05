import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('./connectionUtils.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
});
const { parseServerMessage, reconnectDelay, MAX_RECONNECT_ATTEMPTS, reuseScores, readStored, writeStored, shouldForgetStoredSession } =
  await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

const frame = (value) => JSON.stringify(value);
const gameState = {
  type: 'gameState',
  players: [{ id: 'p', name: '蛇', color: '#fff', alive: true, dir: 'right', snake: [{ x: 1, y: 2 }] }],
  foods: [{ id: 'f', x: 3, y: 4 }],
  scores: { p: { name: '蛇', alive: true, score: 10 } },
};

test('valid welcome keeps dead reconnection state and game frames preserve queued-direction metadata', () => {
  const welcome = { type: 'welcome', playerId: 'p', gridWidth: 60, gridHeight: 40,
    reconnectToken: 'new-token', alive: false, dir: 'up' };
  assert.deepEqual(parseServerMessage(frame(welcome)), welcome);
  assert.deepEqual(parseServerMessage(frame(gameState)), gameState);
  const error = { type: 'error', code: 'invalid_token', message: 'expired' };
  assert.deepEqual(parseServerMessage(frame(error)), error);
});

test('malformed frames cannot replace valid board state', () => {
  for (const data of ['{', 'null', '[]', frame({ type: 'unknown' }), frame({ type: 'gameState', players: null })]) {
    assert.equal(parseServerMessage(data), null);
  }
  assert.equal(parseServerMessage(frame({ ...gameState, players: [{ ...gameState.players[0], snake: [null] }] })), null);
  assert.equal(parseServerMessage(frame({ ...gameState, foods: [{ id: 'f', x: '3', y: 4 }] })), null);
  assert.equal(parseServerMessage(frame({ ...gameState, scores: { p: { name: '蛇', alive: true, score: null } } })), null);
  assert.equal(parseServerMessage(frame({ type: 'welcome', playerId: 'p', gridWidth: 0, gridHeight: 40 })), null);
  const death = { type: 'playerDied', victim: 'a', victimName: 'A', killer: null, killerName: null, cause: 'wall', scoringKill: false };
  assert.deepEqual(parseServerMessage(frame(death)), death);
  assert.deepEqual(parseServerMessage(frame({ type: 'youDied', killerName: 'B', cause: 'body', scoringKill: false })), { type: 'youDied', killerName: 'B', cause: 'body', scoringKill: false });
  assert.equal(parseServerMessage(frame({ type: 'playerDied', victim: 'a', victimName: 'A', killer: null, killerName: null, cause: 'nope' })), null);
  assert.equal(parseServerMessage(frame({ ...gameState, players: [{ ...gameState.players[0], frozen: true }] })).players[0].frozen, true);
  assert.equal(parseServerMessage(frame({ ...gameState, players: [{ ...gameState.players[0], frozen: 'yes' }] })), null);
});

test('a displaced page forgets only the token it still owns', () => {
  assert.equal(shouldForgetStoredSession('old-token', 'old-token'), true);
  assert.equal(shouldForgetStoredSession(null, 'old-token'), true);
  assert.equal(shouldForgetStoredSession('new-token', 'old-token'), false);
  assert.equal(shouldForgetStoredSession('new-token', null), false);
});

test('bounded retry delays leave time for server session recovery', () => {
  assert.deepEqual(Array.from({ length: MAX_RECONNECT_ATTEMPTS }, (_, index) => reconnectDelay(index)),
    [500, 1000, 2000, 4000, 8000]);
  assert.equal(reconnectDelay(100), 8000);
});

test('score identity changes only when score, player name, alive state or membership changes', () => {
  const previous = gameState.scores;
  assert.equal(reuseScores(previous, structuredClone(previous)), previous);
  for (const update of [{ score: 11 }, { name: '新名字' }, { alive: false }]) {
    const next = { p: { ...previous.p, ...update } };
    assert.equal(reuseScores(previous, next), next);
  }
  const empty = {};
  assert.equal(reuseScores(previous, empty), empty);
});

test('blocked browser storage is harmless for reads, writes and removal', () => {
  const previousWindow = globalThis.window;
  globalThis.window = { get localStorage() { throw new Error('blocked'); } };
  try {
    assert.equal(readStored('snake_token'), null);
    assert.doesNotThrow(() => writeStored('snake_token', 'token'));
    assert.doesNotThrow(() => writeStored('snake_token', null));
  } finally {
    globalThis.window = previousWindow;
  }
});
