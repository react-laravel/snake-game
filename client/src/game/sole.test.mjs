import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('./sole.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
});
const { isSoleSurvivor, soleSurvivorId, soleSurvivorLabel } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

test('a sole survivor requires a thinned field that once had at least three living snakes', () => {
  assert.equal(isSoleSurvivor({ alive: true, livingCount: 1, peakLiving: 1 }), false);
  assert.equal(isSoleSurvivor({ alive: true, livingCount: 1, peakLiving: 2 }), false);
  assert.equal(isSoleSurvivor({ alive: true, livingCount: 2, peakLiving: 5 }), false);
  assert.equal(isSoleSurvivor({ alive: false, livingCount: 1, peakLiving: 4 }), false);
  assert.equal(isSoleSurvivor({ alive: true, livingCount: 1, peakLiving: 3 }), true);
  assert.equal(isSoleSurvivor({ alive: true, livingCount: 1, peakLiving: 6 }), true);
});

test('the sole surviving id is marked, and a small lobby is left unmarked', () => {
  const players = [
    { id: 'a', alive: false },
    { id: 'b', alive: true },
    { id: 'c', alive: false },
  ];
  assert.equal(soleSurvivorId(players, 2), null);
  assert.equal(soleSurvivorId(players, 3), 'b');
  assert.equal(soleSurvivorId([{ id: 'a', alive: true }, { id: 'b', alive: true }], 4), null);
  assert.equal(soleSurvivorId([], 5), null);
  assert.equal(soleSurvivorLabel(true), '独活');
  assert.equal(soleSurvivorLabel(false), '');
});
