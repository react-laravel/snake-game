import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('./sessionRecap.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
});
const {
  createSession,
  trackSession,
  finalizeSession,
  formatSessionTime,
  isMeaningfulSession,
  sessionRecapCopy,
} = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('a session counts lives, banks finished lives, and keeps the best rank and length', () => {
  let session = createSession(1000);
  session = trackSession(session, { alive: true, wasAlive: false, maxLength: 3, foods: 0, kills: 0, rank: 3 });
  session = trackSession(session, { alive: true, wasAlive: true, maxLength: 8, foods: 5, kills: 1, rank: 1 });
  session = trackSession(session, { alive: false, wasAlive: true, maxLength: 8, foods: 5, kills: 1, rank: 2 });
  session = trackSession(session, { alive: false, wasAlive: false, maxLength: 8, foods: 5, kills: 1, rank: 4 });
  session = trackSession(session, { alive: true, wasAlive: false, maxLength: 3, foods: 0, kills: 0, rank: 4 });
  session = trackSession(session, { alive: true, wasAlive: true, maxLength: 4, foods: 1, kills: 0, rank: 2 });
  assert.equal(session.lives, 2);
  assert.equal(session.bankedFoods, 5);
  assert.equal(session.bankedKills, 1);
  assert.equal(session.maxLength, 8);
  assert.equal(session.bestRank, 1);
  const stats = finalizeSession(session, { score: 240, nowMs: 73000, foods: 1, kills: 0, maxLength: 4, alive: true });
  assert.deepEqual(stats, {
    score: 240, lives: 2, maxLength: 8, foods: 6, kills: 1, durationMs: 72000, bestRank: 1,
  });
  const afterDeath = trackSession(session, { alive: false, wasAlive: true, maxLength: 4, foods: 1, kills: 0, rank: 3 });
  const frozen = finalizeSession(afterDeath, { score: 240, nowMs: 73000, foods: 1, kills: 0, maxLength: 4, alive: false });
  assert.equal(frozen.foods, 6);
  assert.equal(frozen.kills, 1);
});

test('session recap copy stays compact and skips empty sessions', () => {
  assert.equal(formatSessionTime(0), '0 秒');
  assert.equal(formatSessionTime(59000), '59 秒');
  assert.equal(formatSessionTime(60000), '1 分');
  assert.equal(formatSessionTime(125000), '2 分 5 秒');
  assert.equal(isMeaningfulSession({
    score: 0, lives: 0, maxLength: 0, foods: 0, kills: 0, durationMs: 0, bestRank: null,
  }), false);
  assert.equal(
    sessionRecapCopy({ score: 240, lives: 2, maxLength: 18, foods: 6, kills: 1, durationMs: 125000, bestRank: 1 }),
    '上一局 · 积分 240 · 2 分 5 秒 · 2 条命 · 最长 18 节 · 食物 6 · 击杀 1 · 最好第 1 名',
  );
  assert.equal(sessionRecapCopy({
    score: 0, lives: 0, maxLength: 0, foods: 0, kills: 0, durationMs: 0, bestRank: null,
  }), null);
});
