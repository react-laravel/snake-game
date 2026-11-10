import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('./restore.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
});
const { connectionRestored, restoreCopy } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

test('a restored session is a reconnect or retry, not the first join', () => {
  assert.equal(connectionRestored(null, 'connected'), false);
  assert.equal(connectionRestored('idle', 'connected'), false);
  assert.equal(connectionRestored('connecting', 'connected'), false);
  assert.equal(connectionRestored('connected', 'connected'), false);
  assert.equal(connectionRestored('connected', 'reconnecting'), false);
  assert.equal(connectionRestored('reconnecting', 'error'), false);
  assert.equal(connectionRestored('reconnecting', 'connected'), true);
  assert.equal(connectionRestored('error', 'connected'), true);
});

test('restore copy reassures a living snake and keeps score in mind when dead', () => {
  assert.equal(restoreCopy(true), '连接已恢复，蛇还在场上');
  assert.equal(restoreCopy(false), '连接已恢复，积分仍保留');
});
