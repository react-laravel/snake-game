import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('./invite.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
});
const { inviteUrl } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('invite links keep a single trailing slash', () => {
  assert.equal(inviteUrl('https://play.example', '/snake'), 'https://play.example/snake/');
  assert.equal(inviteUrl('https://play.example', '/snake/'), 'https://play.example/snake/');
});
