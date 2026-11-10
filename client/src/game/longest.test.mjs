import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('./longest.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
});
const { longestAliveId } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('the longest living snake wins, and a score tie keeps the leader', () => {
  assert.equal(longestAliveId([]), null);
  assert.equal(longestAliveId([{ id: 'dead', alive: false, length: 20 }]), null);
  assert.equal(longestAliveId([
    { id: 'lead', alive: true, length: 6 },
    { id: 'long', alive: true, length: 9 },
  ]), 'long');
  assert.equal(longestAliveId([
    { id: 'lead', alive: true, length: 6 },
    { id: 'tied', alive: true, length: 6 },
  ]), 'lead');
});
