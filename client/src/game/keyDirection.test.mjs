import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('./keyDirection.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
});
const { keyDirection } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

test('arrows and WASD letters still steer, including a shifted W', () => {
  assert.equal(keyDirection('ArrowUp'), 'up');
  assert.equal(keyDirection('ArrowLeft'), 'left');
  assert.equal(keyDirection('w'), 'up');
  assert.equal(keyDirection('a'), 'left');
  assert.equal(keyDirection('s'), 'down');
  assert.equal(keyDirection('d'), 'right');
  assert.equal(keyDirection('W'), 'up');
  assert.equal(keyDirection(' '), null);
  assert.equal(keyDirection('Enter', 'Enter'), null);
});

test('physical WASD positions win even when the layout letter is different', () => {
  assert.equal(keyDirection('z', 'KeyW'), 'up');
  assert.equal(keyDirection('q', 'KeyA'), 'left');
  assert.equal(keyDirection('s', 'KeyS'), 'down');
  assert.equal(keyDirection('d', 'KeyD'), 'right');
  assert.equal(keyDirection('ArrowDown', 'ArrowDown'), 'down');
  assert.equal(keyDirection('w', 'KeyW'), 'up');
});
