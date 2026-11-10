import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('./personalBest.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
});
const { readPersonalBest, updatePersonalBest } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

const memory = new Map();
test('personal best tracks the highest score in local storage', () => {
  globalThis.localStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: (key) => memory.delete(key),
  };
  assert.equal(readPersonalBest(), 0);
  assert.equal(updatePersonalBest(42), 42);
  assert.equal(readPersonalBest(), 42);
  assert.equal(updatePersonalBest(30), 42);
  assert.equal(updatePersonalBest(100), 100);
  memory.clear();
});
