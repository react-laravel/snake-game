import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('./heading.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
});
const { parseHeadingDir, headingCopy, nextHeadingStart, headingNotice, HEADING_MS } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

test('heading copy names the spawn direction and invites an immediate turn', () => {
  assert.equal(parseHeadingDir('right'), 'right');
  assert.equal(parseHeadingDir('up'), 'up');
  assert.equal(parseHeadingDir('sideways'), null);
  assert.equal(parseHeadingDir(undefined), null);
  assert.equal(headingCopy('right'), '向右出发 · 现在就能转向');
  assert.equal(headingCopy('left'), '向左出发 · 现在就能转向');
  assert.equal(headingCopy('up'), '向上出发 · 现在就能转向');
  assert.equal(headingCopy('down'), '向下出发 · 现在就能转向');
});

test('the first living snapshot and each later respawn start a heading, then it expires', () => {
  const joined = nextHeadingStart({
    hasSeenSelf: false, wasAlive: false, alive: true, dir: 'right', start: null, nowMs: 1000,
  });
  assert.deepEqual(joined, { hasSeenSelf: true, start: { startedAt: 1000, dir: 'right' } });
  assert.equal(headingNotice(joined.start, 1000), '向右出发 · 现在就能转向');
  assert.equal(headingNotice(joined.start, 1000 + HEADING_MS - 1), '向右出发 · 现在就能转向');
  assert.equal(headingNotice(joined.start, 1000 + HEADING_MS), null);

  const turned = nextHeadingStart({
    hasSeenSelf: true, wasAlive: true, alive: true, dir: 'up', start: joined.start, nowMs: 1300,
  });
  assert.deepEqual(turned.start, { startedAt: 1000, dir: 'right' });

  const dead = nextHeadingStart({
    hasSeenSelf: true, wasAlive: true, alive: false, dir: 'right', start: joined.start, nowMs: 2000,
  });
  assert.deepEqual(dead, { hasSeenSelf: true, start: null });
  assert.equal(headingNotice(dead.start, 2000), null);

  const respawned = nextHeadingStart({
    hasSeenSelf: true, wasAlive: false, alive: true, dir: 'down', start: null, nowMs: 2500,
  });
  assert.deepEqual(respawned.start, { startedAt: 2500, dir: 'down' });
  assert.equal(headingNotice(respawned.start, 2500), '向下出发 · 现在就能转向');

  const noDir = nextHeadingStart({
    hasSeenSelf: false, wasAlive: false, alive: true, dir: undefined, start: null, nowMs: 0,
  });
  assert.deepEqual(noDir, { hasSeenSelf: true, start: null });
});
