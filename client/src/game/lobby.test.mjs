import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('./lobby.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
});
const {
  lobbyPresenceCopy,
  lobbyRoster,
  lobbyOverflowCopy,
  lobbyPlayerStatus,
  LOBBY_ROSTER_LIMIT,
} = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('lobby presence copy covers idle, empty, and occupied arenas', () => {
  assert.equal(lobbyPresenceCopy({ linked: false, total: 3, alive: 2 }), '正在连接竞技场…');
  assert.equal(lobbyPresenceCopy({ linked: true, total: 0, alive: 0 }), '场地空闲，等你加入');
  assert.equal(lobbyPresenceCopy({ linked: true, total: 4, alive: 2 }), '4 人在场 · 2 存活');
});

test('the lobby roster keeps scoreboard order and caps the list', () => {
  assert.deepEqual(lobbyRoster({}), []);
  const roster = lobbyRoster({
    c: { name: 'Cara', score: 10, alive: true },
    a: { name: 'Ann', score: 40, alive: true },
    b: { name: 'Bob', score: 40, alive: false },
  });
  assert.deepEqual(roster.map((player) => player.id), ['a', 'b', 'c']);
  const many = Object.fromEntries(Array.from({ length: 8 }, (_, index) => [
    `p${index}`,
    { name: `P${index}`, score: 8 - index, alive: true },
  ]));
  const limited = lobbyRoster(many);
  assert.equal(limited.length, LOBBY_ROSTER_LIMIT);
  assert.deepEqual(limited.map((player) => player.id), ['p0', 'p1', 'p2', 'p3', 'p4']);
  assert.equal(lobbyOverflowCopy(8, limited.length), '还有 3 人');
  assert.equal(lobbyOverflowCopy(5, 5), null);
  assert.equal(lobbyPlayerStatus(true), '对局中');
  assert.equal(lobbyPlayerStatus(false), '已出局');
});
