import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('./lifeStats.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
});
const {
  nextLifeCounters,
  scoreboardPlace,
  formatSurvived,
  lifeRecapCopy,
  EMPTY_LIFE,
} = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('a life counts growth and kills, then resets on the next spawn', () => {
  const spawned = nextLifeCounters(EMPTY_LIFE, {
    alive: true, wasAlive: false, length: 3, previousLength: null, newKills: 0,
    nowMs: 1000, startedAt: null, rank: 4, fieldSize: 6,
  });
  assert.deepEqual(spawned.counters, { foods: 0, kills: 0, survivedMs: 0, maxLength: 3, rank: 4, fieldSize: 6 });
  assert.equal(spawned.startedAt, 1000);
  const ate = nextLifeCounters(spawned.counters, {
    alive: true, wasAlive: true, length: 4, previousLength: spawned.previousLength, newKills: 1,
    nowMs: 2500, startedAt: spawned.startedAt, rank: 2, fieldSize: 6,
  });
  assert.deepEqual(ate.counters, { foods: 1, kills: 1, survivedMs: 1500, maxLength: 4, rank: 2, fieldSize: 6 });
  const dead = nextLifeCounters(ate.counters, {
    alive: false, wasAlive: true, length: 0, previousLength: ate.previousLength, newKills: 0,
    nowMs: 43000, startedAt: ate.startedAt, rank: 3, fieldSize: 5,
  });
  assert.deepEqual(dead.counters, { foods: 1, kills: 1, survivedMs: 42000, maxLength: 4, rank: 3, fieldSize: 5 });
  const stillDead = nextLifeCounters(dead.counters, {
    alive: false, wasAlive: false, length: 0, previousLength: null, newKills: 0,
    nowMs: 80000, startedAt: dead.startedAt, rank: 5, fieldSize: 5,
  });
  assert.deepEqual(stillDead.counters, dead.counters);
  const respawned = nextLifeCounters(stillDead.counters, {
    alive: true, wasAlive: false, length: 3, previousLength: null, newKills: 0,
    nowMs: 90000, startedAt: stillDead.startedAt, rank: 5, fieldSize: 5,
  });
  assert.deepEqual(respawned.counters, { foods: 0, kills: 0, survivedMs: 0, maxLength: 3, rank: 5, fieldSize: 5 });
});

test('death keeps the peak length even after the body is cleared', () => {
  const mid = nextLifeCounters(EMPTY_LIFE, {
    alive: true, wasAlive: false, length: 3, previousLength: null, newKills: 0,
    nowMs: 0, startedAt: null, rank: 1, fieldSize: 2,
  });
  const grown = nextLifeCounters(mid.counters, {
    alive: true, wasAlive: true, length: 12, previousLength: mid.previousLength, newKills: 0,
    nowMs: 800, startedAt: mid.startedAt, rank: 1, fieldSize: 2,
  });
  const shrunkDeath = nextLifeCounters(grown.counters, {
    alive: false, wasAlive: true, length: 0, previousLength: 9, newKills: 0,
    nowMs: 1000, startedAt: grown.startedAt, rank: 2, fieldSize: 2,
  });
  assert.equal(shrunkDeath.counters.maxLength, 12);
});

test('scoreboard place, survival copy, and the recap line stay compact', () => {
  assert.deepEqual(scoreboardPlace([['a', {}], ['me', {}], ['c', {}]], 'me'), { rank: 2, fieldSize: 3 });
  assert.deepEqual(scoreboardPlace([], 'me'), { rank: null, fieldSize: 0 });
  assert.deepEqual(scoreboardPlace([['a', {}]], null), { rank: null, fieldSize: 1 });
  assert.equal(formatSurvived(0), '存活 0 秒');
  assert.equal(formatSurvived(59999), '存活 59 秒');
  assert.equal(formatSurvived(60000), '存活 1 分');
  assert.equal(formatSurvived(125000), '存活 2 分 5 秒');
  assert.equal(
    lifeRecapCopy({ survivedMs: 42000, maxLength: 18, rank: 2, fieldSize: 6 }),
    '存活 42 秒 · 18 节 · 第 2 / 6 名',
  );
  assert.equal(lifeRecapCopy({ survivedMs: 800, maxLength: 0, rank: null, fieldSize: 0 }), '存活 0 秒');
});
