import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('./runway.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
});
const {
  spawnRunway,
  snakeBlockKeys,
  rememberSpawnHint,
  shouldShowSpawnRunway,
  runwayHintCopy,
  RUNWAY_STEPS,
  RUNWAY_MS,
} = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

const grid = { w: 20, h: 10 };

test('a spawn runway walks forward and stops at a wall', () => {
  assert.deepEqual(spawnRunway(null, 'right', grid, new Set()), []);
  assert.deepEqual(spawnRunway({ x: 2, y: 2 }, undefined, grid, new Set()), []);
  assert.deepEqual(spawnRunway({ x: 18, y: 2 }, 'right', grid, new Set()), [{ x: 19, y: 2 }]);
  assert.deepEqual(spawnRunway({ x: 0, y: 0 }, 'up', grid, new Set()), []);
  const ahead = spawnRunway({ x: 1, y: 5 }, 'right', grid, new Set());
  assert.equal(ahead.length, RUNWAY_STEPS);
  assert.deepEqual(ahead[0], { x: 2, y: 5 });
  assert.deepEqual(ahead.at(-1), { x: 1 + RUNWAY_STEPS, y: 5 });
});

test('snake bodies block the runway and food does not', () => {
  const blocked = snakeBlockKeys([
    { alive: true, snake: [{ x: 5, y: 4 }, { x: 4, y: 4 }] },
    { alive: false, snake: [{ x: 3, y: 4 }] },
  ]);
  assert.deepEqual(spawnRunway({ x: 1, y: 4 }, 'right', grid, blocked), [
    { x: 2, y: 4 },
    { x: 3, y: 4 },
  ]);
  // Food is not included in snakeBlockKeys, so a food cell stays open.
  assert.equal(spawnRunway({ x: 1, y: 1 }, 'right', grid, blocked).length, RUNWAY_STEPS);
});

test('the spawn hint starts on becoming alive and lasts for the runway window', () => {
  assert.equal(rememberSpawnHint(false, false, 100, 50), null);
  assert.equal(rememberSpawnHint(false, true, 200, null), 200);
  assert.equal(rememberSpawnHint(true, true, 400, 200), 200);
  assert.equal(rememberSpawnHint(true, false, 500, 200), null);
  assert.equal(shouldShowSpawnRunway({ alive: true, startedAt: 0, nowMs: 0 }), true);
  assert.equal(shouldShowSpawnRunway({ alive: true, startedAt: 0, nowMs: RUNWAY_MS - 1 }), true);
  assert.equal(shouldShowSpawnRunway({ alive: true, startedAt: 0, nowMs: RUNWAY_MS }), false);
  assert.equal(shouldShowSpawnRunway({ alive: false, startedAt: 0, nowMs: 10 }), false);
  assert.equal(shouldShowSpawnRunway({ alive: true, startedAt: null, nowMs: 10 }), false);
  assert.equal(shouldShowSpawnRunway({ alive: true, startedAt: 100, nowMs: 50 }), false);
});

test('runway copy names the open lead', () => {
  assert.equal(runwayHintCopy(8), '前方 8 格开阔');
  assert.equal(runwayHintCopy(1), '前方 1 格开阔');
  assert.equal(runwayHintCopy(0), null);
});
