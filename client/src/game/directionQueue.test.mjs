import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('./directionQueue.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
});
const { canQueueDirection, consumeAppliedTurn } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

test('direction queue mirrors the server turn limits', () => {
  assert.equal(canQueueDirection('up', 'right', []), true);
  assert.equal(canQueueDirection('left', 'right', []), false);
  assert.equal(canQueueDirection('up', 'right', ['up']), false);
  assert.equal(canQueueDirection('left', 'right', ['up']), true);
  assert.equal(canQueueDirection('down', 'right', ['up', 'left']), false);
  assert.deepEqual(consumeAppliedTurn(['left'], 'right', 'right'), ['left']);
  assert.deepEqual(consumeAppliedTurn(['left'], 'right', 'up'), []);
});
