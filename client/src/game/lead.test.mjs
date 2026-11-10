import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('./lead.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
});
const { tookTheLead, isLeading, leadCopy, leadingLabel } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

test('taking the lead requires a known previous rank and at least one opponent', () => {
  assert.equal(tookTheLead({ previousRank: null, nextRank: 1, fieldSize: 3, alive: true }), false);
  assert.equal(tookTheLead({ previousRank: 1, nextRank: 1, fieldSize: 3, alive: true }), false);
  assert.equal(tookTheLead({ previousRank: 2, nextRank: 1, fieldSize: 1, alive: true }), false);
  assert.equal(tookTheLead({ previousRank: 2, nextRank: 1, fieldSize: 3, alive: false }), false);
  assert.equal(tookTheLead({ previousRank: 2, nextRank: 2, fieldSize: 3, alive: true }), false);
  assert.equal(tookTheLead({ previousRank: 2, nextRank: 1, fieldSize: 3, alive: true }), true);
  assert.equal(tookTheLead({ previousRank: 4, nextRank: 1, fieldSize: 2, alive: true }), true);
});

test('the leading label is only for a living first place among others', () => {
  assert.equal(isLeading({ rank: 1, fieldSize: 2, alive: true }), true);
  assert.equal(isLeading({ rank: 1, fieldSize: 1, alive: true }), false);
  assert.equal(isLeading({ rank: 1, fieldSize: 4, alive: false }), false);
  assert.equal(isLeading({ rank: 2, fieldSize: 4, alive: true }), false);
  assert.equal(leadCopy(), '升到第 1 名');
  assert.equal(leadingLabel(true), '领先');
  assert.equal(leadingLabel(false), '');
});
