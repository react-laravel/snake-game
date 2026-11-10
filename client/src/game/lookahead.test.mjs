import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('./lookahead.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
});
const { immediateThreat } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

const grid = { w: 10, h: 8 };
const self = (snake, dir = 'right', frozen = false) => ({
  id: 'me', name: '我', color: '#fff', alive: true, dir, frozen, snake,
});

test('the next cell warns for a wall, a body, and a queued turn', () => {
  assert.equal(immediateThreat([self([{ x: 9, y: 2 }])], 'me', [], grid)?.distance, 1);
  const queued = self([{ x: 1, y: 0 }, { x: 0, y: 0 }], 'right');
  assert.equal(immediateThreat([queued], 'me', ['up'], grid)?.kind, 'wall');
  const blocked = [
    self([{ x: 2, y: 2 }, { x: 1, y: 2 }], 'right'),
    { id: 'them', name: '敌', color: '#aaa', alive: true, dir: 'left', frozen: true, snake: [{ x: 3, y: 2 }] },
  ];
  assert.deepEqual(immediateThreat(blocked, 'me', [], grid), { kind: 'snake', distance: 1, x: 3, y: 2, mark: { x: 3, y: 2 } });
});

test('a clear next cell still warns when the cell after it is a wall', () => {
  const approaching = self([{ x: 8, y: 2 }, { x: 7, y: 2 }], 'right');
  assert.deepEqual(immediateThreat([approaching], 'me', [], grid), { kind: 'wall', distance: 2, x: 10, y: 2, mark: { x: 9, y: 2 } });
  assert.equal(immediateThreat([approaching], 'me', ['up'], grid), null);
});

test('shared next cells and swapped heads warn of a head-on', () => {
  const me = self([{ x: 2, y: 2 }, { x: 1, y: 2 }], 'right');
  const them = { id: 'them', name: '敌', color: '#aaa', alive: true, dir: 'left', frozen: false, snake: [{ x: 4, y: 2 }, { x: 5, y: 2 }] };
  assert.deepEqual(immediateThreat([me, them], 'me', [], grid), { kind: 'head-on', distance: 1, x: 3, y: 2, mark: { x: 3, y: 2 } });
  const shortMe = self([{ x: 2, y: 2 }], 'right');
  const shortThem = { ...them, snake: [{ x: 3, y: 2 }] };
  assert.equal(immediateThreat([shortMe, shortThem], 'me', [], grid)?.kind, 'head-on');
  assert.equal(immediateThreat([me, them], 'me', ['up'], grid), null);
  assert.equal(immediateThreat([me, { ...them, frozen: true }], 'me', [], grid), null);
});

test('a moving tail is not treated as a solid cell', () => {
  const tail = self([{ x: 2, y: 2 }, { x: 3, y: 2 }], 'right');
  assert.equal(immediateThreat([tail], 'me', undefined, grid), null);
  const parked = { id: 'them', name: '敌', color: '#aaa', alive: true, dir: 'left', frozen: true, snake: [{ x: 3, y: 2 }] };
  assert.equal(immediateThreat([self([{ x: 2, y: 2 }], 'right'), parked], 'me', undefined, grid)?.kind, 'snake');
});
