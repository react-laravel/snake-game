import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('./spectator.ts', import.meta.url), 'utf8');
const longestSource = await readFile(new URL('./longest.ts', import.meta.url), 'utf8');
const { outputText: longestOut } = ts.transpileModule(longestSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
});
const longestUrl = `data:text/javascript;base64,${Buffer.from(longestOut).toString('base64')}`;
const rewritten = source.replace("./longest", longestUrl);
const { outputText } = ts.transpileModule(rewritten, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
});
const {
  playersForSpectator,
  spectatorKiller,
  pickDeathSpectator,
  cameraFollowId,
  watchingCopy,
  easeCameraPan,
  cameraPanProgress,
  mixCameraHead,
  cameraPanDuration,
  startCameraPan,
  CAMERA_PAN_MS,
} = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

const players = [
  { id: 'me', name: '我', alive: false, length: 0 },
  { id: 'killer', name: '红蛇', alive: true, length: 4 },
  { id: 'lead', name: '榜首', alive: true, length: 6 },
  { id: 'long', name: '长蛇', alive: true, length: 9 },
];

test('a living player does not spectate', () => {
  assert.equal(pickDeathSpectator(false, players, { killerId: 'killer', selfId: 'me' }), null);
});

test('the camera follows a living killer before the longest snake', () => {
  assert.deepEqual(
    pickDeathSpectator(true, players, { killerId: 'killer', killerName: '红蛇', selfId: 'me' }),
    { id: 'killer', name: '红蛇' },
  );
});

test('a dead or missing killer falls back to the longest living snake', () => {
  const withDeadKiller = players.map((player) => player.id === 'killer' ? { ...player, alive: false, length: 0 } : player);
  assert.deepEqual(pickDeathSpectator(true, withDeadKiller, { killerId: 'killer', selfId: 'me' }), { id: 'long', name: '长蛇' });
  assert.deepEqual(pickDeathSpectator(true, players, { killerId: 'gone', selfId: 'me' }), { id: 'long', name: '长蛇' });
  assert.deepEqual(pickDeathSpectator(true, players, { selfId: 'me' }), { id: 'long', name: '长蛇' });
});

test('youDied can resolve the killer by name when the id is absent', () => {
  assert.deepEqual(
    pickDeathSpectator(true, players, { killerId: null, killerName: '红蛇', selfId: 'me' }),
    { id: 'killer', name: '红蛇' },
  );
});

test('equal lengths keep the earlier, score-sorted player', () => {
  const tied = [
    { id: 'lead', name: '榜首', alive: true, length: 6 },
    { id: 'tied', name: '并列', alive: true, length: 6 },
  ];
  assert.deepEqual(pickDeathSpectator(true, tied, { selfId: 'me' }), { id: 'lead', name: '榜首' });
});

test('duplicate killer names keep the longest living match', () => {
  const twins = [
    { id: 'a', name: '红蛇', alive: true, length: 3 },
    { id: 'b', name: '红蛇', alive: true, length: 8 },
  ];
  assert.deepEqual(pickDeathSpectator(true, twins, { killerName: '红蛇', selfId: 'me' }), { id: 'b', name: '红蛇' });
});

test('no living snakes means there is no spectator target', () => {
  assert.equal(pickDeathSpectator(true, [{ id: 'me', name: '我', alive: false, length: 0 }], { selfId: 'me' }), null);
});

test('the local player is never chosen as the follow target', () => {
  const onlySelf = [{ id: 'me', name: '我', alive: true, length: 12 }];
  assert.equal(pickDeathSpectator(true, onlySelf, { killerId: 'me', selfId: 'me' }), null);
});

test('playersForSpectator keeps scoreboard order and appends anyone missing from it', () => {
  const raw = [
    { id: 'c', name: 'C', alive: true, snake: { length: 2 } },
    { id: 'a', name: 'A', alive: true, snake: { length: 4 } },
    { id: 'b', name: 'B', alive: false, snake: { length: 0 } },
  ];
  assert.deepEqual(playersForSpectator(raw, [['b', {}], ['a', {}]]), [
    { id: 'b', name: 'B', alive: false, length: 0 },
    { id: 'a', name: 'A', alive: true, length: 4 },
    { id: 'c', name: 'C', alive: true, length: 2 },
  ]);
});

test('spectatorKiller uses the latest matching death, including a youDied victim', () => {
  assert.deepEqual(spectatorKiller([
    { victim: 'me', killer: 'old', killerName: '旧' },
    { victim: 'other', killer: 'x', killerName: 'X' },
    { victim: 'me', killer: 'new', killerName: '新' },
  ], 'me'), { killerId: 'new', killerName: '新' });
  assert.deepEqual(spectatorKiller([
    { victim: 'you', killer: null, killerName: '红蛇' },
  ], 'me'), { killerId: null, killerName: '红蛇' });
  assert.deepEqual(spectatorKiller([
    { victim: 'other', killer: 'x', killerName: 'X' },
  ], 'me'), { killerId: null, killerName: null });
  assert.deepEqual(spectatorKiller([], 'me'), { killerId: null, killerName: null });
  assert.deepEqual(spectatorKiller([{ victim: 'you', killer: null, killerName: '红蛇' }], null), { killerId: null, killerName: null });
});

test('the camera only follows a spectator on a cropped death view', () => {
  assert.equal(cameraFollowId(true, true, 'killer'), 'killer');
  assert.equal(cameraFollowId(true, false, 'killer'), null);
  assert.equal(cameraFollowId(false, true, 'killer'), null);
  assert.equal(cameraFollowId(true, true, null), null);
});

test('watching copy names the followed snake', () => {
  assert.equal(watchingCopy('红蛇'), '正在观看 红蛇');
  assert.equal(watchingCopy(null), null);
});

test('camera pan eases from the last point and snaps when asked', () => {
  assert.equal(easeCameraPan(-1), 0);
  assert.equal(easeCameraPan(0), 0);
  assert.equal(easeCameraPan(1), 1);
  assert.equal(easeCameraPan(2), 1);
  assert.equal(easeCameraPan(0.5), 0.5);
  assert.equal(easeCameraPan(0.25), 0.15625);
  assert.equal(cameraPanProgress(0, 400), 0);
  assert.equal(cameraPanProgress(200, 400), 0.5);
  assert.equal(cameraPanProgress(400, 400), 1);
  assert.equal(cameraPanProgress(800, 400), 1);
  assert.equal(cameraPanProgress(0, 400, true), 1);
  assert.equal(cameraPanProgress(50, 0), 1);
  assert.deepEqual(mixCameraHead({ x: 0, y: 0 }, { x: 10, y: 4 }, 0), { x: 0, y: 0 });
  assert.deepEqual(mixCameraHead({ x: 0, y: 0 }, { x: 10, y: 4 }, 1), { x: 10, y: 4 });
  assert.deepEqual(mixCameraHead({ x: 0, y: 0 }, { x: 10, y: 0 }, 0.5), { x: 5, y: 0 });
});

test('pan duration stays brief and scales with distance', () => {
  assert.equal(cameraPanDuration(null, { x: 10, y: 10 }), CAMERA_PAN_MS);
  assert.equal(cameraPanDuration({ x: 0, y: 0 }, { x: 0, y: 0 }), 280);
  assert.equal(cameraPanDuration({ x: 0, y: 0 }, { x: 10, y: 0 }), 360);
  assert.equal(cameraPanDuration({ x: 0, y: 0 }, { x: 100, y: 0 }), 560);
});

test('a new death follow target pans from the last camera, and respawn snaps', () => {
  const last = { x: 4, y: 8 };
  assert.deepEqual(startCameraPan({
    isDead: true, reducedMotion: false, previousFollowId: null, nextFollowId: 'killer', lastCamera: last,
  }), { panFrom: last, snap: false });
  assert.deepEqual(startCameraPan({
    isDead: true, reducedMotion: false, previousFollowId: 'killer', nextFollowId: 'long', lastCamera: last,
  }), { panFrom: last, snap: false });
  assert.deepEqual(startCameraPan({
    isDead: true, reducedMotion: false, previousFollowId: 'killer', nextFollowId: 'killer', lastCamera: last,
  }), { panFrom: null, snap: false });
  assert.deepEqual(startCameraPan({
    isDead: false, reducedMotion: false, previousFollowId: 'killer', nextFollowId: null, lastCamera: last,
  }), { panFrom: null, snap: true });
  assert.deepEqual(startCameraPan({
    isDead: true, reducedMotion: true, previousFollowId: null, nextFollowId: 'killer', lastCamera: last,
  }), { panFrom: null, snap: true });
  assert.deepEqual(startCameraPan({
    isDead: true, reducedMotion: false, previousFollowId: null, nextFollowId: 'killer', lastCamera: null,
  }), { panFrom: null, snap: true });
  assert.deepEqual(startCameraPan({
    isDead: true, reducedMotion: false, previousFollowId: 'killer', nextFollowId: null, lastCamera: last,
  }), { panFrom: null, snap: true });
});

