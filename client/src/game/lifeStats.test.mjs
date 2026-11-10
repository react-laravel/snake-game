import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('./lifeStats.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
});
const { nextLifeCounters } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('a life counts growth and kills, then resets on the next spawn', () => {
  const spawned = nextLifeCounters({ foods: 4, kills: 1 }, {
    alive: true, wasAlive: false, length: 3, previousLength: null, newKills: 0,
  });
  assert.deepEqual(spawned.counters, { foods: 0, kills: 0 });
  const ate = nextLifeCounters(spawned.counters, {
    alive: true, wasAlive: true, length: 4, previousLength: spawned.previousLength, newKills: 1,
  });
  assert.deepEqual(ate.counters, { foods: 1, kills: 1 });
  const dead = nextLifeCounters(ate.counters, {
    alive: false, wasAlive: true, length: 0, previousLength: ate.previousLength, newKills: 0,
  });
  assert.deepEqual(dead.counters, { foods: 1, kills: 1 });
});
