import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('./directionPad.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
});
const { padButtonClass, padButtonKind } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

test('the live heading lights its button, and a missing heading stays idle', () => {
  assert.equal(padButtonKind('right', 'right'), 'current');
  assert.equal(padButtonKind('up', 'right'), 'idle');
  assert.equal(padButtonKind('left', 'right'), 'idle');
  assert.equal(padButtonKind('down', 'right'), 'idle');
  assert.equal(padButtonKind('up', null), 'idle');
  assert.equal(padButtonKind('up', undefined, []), 'idle');
});

test('the first queued turn marks its button, and later turns stay dark', () => {
  assert.equal(padButtonKind('right', 'right', ['up', 'left']), 'current');
  assert.equal(padButtonKind('up', 'right', ['up', 'left']), 'queued');
  assert.equal(padButtonKind('left', 'right', ['up', 'left']), 'idle');
  assert.equal(padButtonKind('down', 'right', ['up', 'left']), 'idle');
  assert.equal(padButtonKind('up', 'up', ['up']), 'queued');
  assert.equal(padButtonKind('left', null, ['left']), 'queued');
  assert.equal(padButtonClass('idle'), '');
  assert.equal(padButtonClass('current'), ' direction-current');
  assert.equal(padButtonClass('queued'), ' direction-queued');
});
