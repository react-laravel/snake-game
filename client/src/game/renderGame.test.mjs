import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('./renderGame.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } });
const { getViewport, getSnakeMotionShift, getCameraHead, interpolateSnake, nearestFood, nearestOpponent, separateMarkers, foodPointer, shouldShowSnakeName, NAME_RANGE, placeClearOf } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const grid = { w: 60, h: 40 };

test('full-map fit does not lose a column or row to floating point rounding', () => {
  for (const [width, height] of [[814, 559], [1178, 794], [960, 600]]) {
    const view = getViewport(width, height, grid, { x: 59, y: 39 });
    assert.equal(view.columns, 60);
    assert.equal(view.rows, 40);
    assert.equal(view.cropped, false);
    assert.equal(view.x, 0);
    assert.equal(view.y, 0);
    assert.ok(view.offsetX >= 0 && view.offsetY >= 0);
  }
});

test('camera head tracks between grid cells while snakes ease', () => {
  assert.deepEqual(getCameraHead({ x: 10, y: 10 }, 'right', 1), { x: 10, y: 10 });
  const midway = getCameraHead({ x: 10, y: 10 }, 'right', 0.5);
  assert.equal(midway.x, 9.5);
  assert.equal(midway.y, 10);
});

test('a turning snake slides along its own body instead of shearing sideways', () => {
  const previous = [{ x: 2, y: 1 }, { x: 2, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }];
  const current = [{ x: 3, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 0 }, { x: 1, y: 0 }];
  assert.deepEqual(interpolateSnake(previous, current, 0.5), [
    { x: 2.5, y: 1 }, { x: 2, y: 0.5 }, { x: 1.5, y: 0 }, { x: 0.5, y: 0 },
  ]);
  const grown = [{ x: 3, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 0 }];
  assert.deepEqual(interpolateSnake([{ x: 2, y: 0 }, { x: 1, y: 0 }], grown, 0.5), [
    { x: 2.5, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 0 },
  ]);
  assert.equal(interpolateSnake(previous, current, 1), current);
});

test('motion shift eases snakes between server ticks along travel direction', () => {
  assert.deepEqual(getSnakeMotionShift('right', 20, 1), { dx: 0, dy: 0 });
  assert.deepEqual(getSnakeMotionShift(undefined, 20, 0), { dx: 0, dy: 0 });
  const mid = getSnakeMotionShift('up', 20, 0.5);
  assert.equal(mid.dx, 0);
  assert.equal(mid.dy, 10);
  const start = getSnakeMotionShift('left', 16, 0);
  assert.equal(start.dx, 16);
  assert.equal(start.dy, 0);
});

test('food markers move off the minimap rectangle', () => {
  const rect = { left: 80, top: 40, width: 40, height: 30 };
  assert.deepEqual(placeClearOf(10, 10, rect), { x: 10, y: 10 });
  assert.deepEqual(placeClearOf(100, 55, rect), { x: 100, y: 24 });
  assert.deepEqual(placeClearOf(82, 55, rect), { x: 64, y: 55 });
});

test('nearby snakes keep their names and distant ones do not', () => {
  assert.equal(shouldShowSnakeName(true, { x: 0, y: 0 }, { x: 40, y: 40 }), true);
  assert.equal(shouldShowSnakeName(false, null, { x: 40, y: 40 }), true);
  assert.equal(shouldShowSnakeName(false, { x: 0, y: 0 }, { x: NAME_RANGE, y: 0 }), true);
  assert.equal(shouldShowSnakeName(false, { x: 0, y: 0 }, { x: NAME_RANGE + 1, y: 0 }), false);
});

test('the nearest opponent is the closest living head, and overlapping arrows split apart', () => {
  const players = [
    { id: 'me', alive: true, snake: [{ x: 1, y: 1 }] },
    { id: 'far', alive: true, snake: [{ x: 20, y: 1 }] },
    { id: 'near', alive: true, snake: [{ x: 4, y: 1 }] },
    { id: 'dead', alive: false, snake: [{ x: 2, y: 1 }] },
  ];
  assert.deepEqual(nearestOpponent('me', { x: 1, y: 1 }, players), { x: 4, y: 1, distance: 3 });
  const tied = [
    { id: 'a', alive: true, snake: [{ x: 3, y: 1 }] },
    { id: 'b', alive: true, snake: [{ x: 1, y: 3 }] },
  ];
  assert.equal(nearestOpponent('me', { x: 1, y: 1 }, tied)?.x, 3);
  assert.deepEqual(separateMarkers({ x: 10, y: 10 }, { x: 40, y: 10 }), { x: 40, y: 10 });
  assert.deepEqual(separateMarkers({ x: 10, y: 10 }, { x: 10, y: 10 }), { x: 28, y: 10 });
});

test('nearest off-screen food points at the visible edge', () => {
  const foods = [{ x: 2, y: 2 }, { x: 50, y: 2 }];
  assert.deepEqual(nearestFood({ x: 4, y: 2 }, foods), { x: 2, y: 2, distance: 2 });
  const view = { x: 0, y: 0, columns: 10, rows: 8 };
  assert.equal(foodPointer(view, { x: 3, y: 3 }), null);
  const pointer = foodPointer(view, { x: 40, y: 3 });
  assert.ok(pointer);
  assert.ok(pointer.x >= 9 && pointer.x <= 10);
  assert.ok(pointer.dx > 0);
});

test('small-screen cameras keep every head position visible without leaving board bounds', () => {
  for (const [width, height] of [[300, 390], [372, 690], [620, 280]]) {
    for (const head of [{ x: 0, y: 0 }, { x: 30, y: 20 }, { x: 59, y: 39 }]) {
      const view = getViewport(width, height, grid, head);
      assert.equal(view.cropped, true);
      assert.ok(view.cell >= 8);
      assert.ok(view.x >= 0 && view.y >= 0);
      assert.ok(view.x + view.columns <= grid.w && view.y + view.rows <= grid.h);
      assert.ok(head.x >= view.x && head.x < view.x + view.columns);
      assert.ok(head.y >= view.y && head.y < view.y + view.rows);
      assert.ok(view.offsetX >= 0 && view.offsetY >= 0);
    }
  }
});
