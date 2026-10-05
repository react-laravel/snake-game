import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('./renderGame.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } });
const { getViewport } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
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

test('small-screen cameras keep every head position visible without leaving board bounds', () => {
  for (const [width, height] of [[300, 390], [372, 690], [620, 280]]) {
    for (const head of [{ x: 0, y: 0 }, { x: 30, y: 20 }, { x: 59, y: 39 }]) {
      const view = getViewport(width, height, grid, head);
      assert.equal(view.cropped, true);
      assert.ok(view.cell >= 12);
      assert.ok(view.x >= 0 && view.y >= 0);
      assert.ok(view.x + view.columns <= grid.w && view.y + view.rows <= grid.h);
      assert.ok(head.x >= view.x && head.x < view.x + view.columns);
      assert.ok(head.y >= view.y && head.y < view.y + view.rows);
      assert.ok(view.offsetX >= 0 && view.offsetY >= 0);
    }
  }
});
