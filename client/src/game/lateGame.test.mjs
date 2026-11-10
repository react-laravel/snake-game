import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('./lateGame.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
});
const {
  rememberPeakLiving,
  livingPlayers,
  lateGameStatus,
  shouldRevealAllNames,
} = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('peak living only moves upward and living players are the ones still in play', () => {
  assert.equal(rememberPeakLiving(0, 4), 4);
  assert.equal(rememberPeakLiving(4, 2), 4);
  assert.equal(rememberPeakLiving(4, 6), 6);
  assert.equal(rememberPeakLiving(3, -1), 3);
  assert.deepEqual(
    livingPlayers([
      { id: 'a', alive: true },
      { id: 'b', alive: false },
      { id: 'c', alive: true },
    ]).map((player) => player.id),
    ['a', 'c'],
  );
});

test('a small lobby is not treated as a late-game finale', () => {
  assert.deepEqual(lateGameStatus({ livingCount: 1, peakLiving: 1, selfAlive: true }), { kind: null, copy: null });
  assert.deepEqual(lateGameStatus({ livingCount: 2, peakLiving: 2, selfAlive: true }), { kind: null, copy: null });
  assert.deepEqual(lateGameStatus({ livingCount: 3, peakLiving: 3, selfAlive: true }), { kind: null, copy: null });
  assert.deepEqual(lateGameStatus({ livingCount: 4, peakLiving: 6, selfAlive: true }), { kind: null, copy: null });
  assert.deepEqual(lateGameStatus({ livingCount: 0, peakLiving: 5, selfAlive: false }), { kind: null, copy: null });
});

test('a thinned field names the late game, and the last snake gets a clear callout', () => {
  assert.deepEqual(lateGameStatus({ livingCount: 3, peakLiving: 6, selfAlive: true }), { kind: 'late', copy: '残局 · 还剩 3 人' });
  assert.deepEqual(lateGameStatus({ livingCount: 2, peakLiving: 3, selfAlive: true }), { kind: 'duel', copy: '残局 · 还剩 2 人' });
  assert.deepEqual(lateGameStatus({ livingCount: 1, peakLiving: 4, selfAlive: true }), { kind: 'solo', copy: '全场只剩你' });
  assert.deepEqual(
    lateGameStatus({ livingCount: 1, peakLiving: 4, selfAlive: false, soleName: '红蛇' }),
    { kind: 'solo', copy: '只剩 红蛇 还在场上' },
  );
  assert.deepEqual(lateGameStatus({ livingCount: 1, peakLiving: 3, selfAlive: false }), { kind: 'solo', copy: '还剩 1 人' });
  assert.equal(shouldRevealAllNames('duel'), true);
  assert.equal(shouldRevealAllNames(null), false);
});
