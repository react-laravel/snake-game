import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('./boardPattern.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
});
const { cellParity, cellFill, visibleBoardCells, CELL_DARK, CELL_LIGHT } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

test('the checker is locked to world cells and alternates with neighbors', () => {
  assert.equal(cellParity(0, 0), 0);
  assert.equal(cellParity(1, 0), 1);
  assert.equal(cellParity(0, 1), 1);
  assert.equal(cellParity(1, 1), 0);
  assert.equal(cellParity(10.8, 20.2), cellParity(10, 20));
  assert.equal(cellFill(0, 0), CELL_DARK);
  assert.equal(cellFill(1, 0), CELL_LIGHT);
  assert.equal(cellFill(2, 2), cellFill(0, 0));
  assert.notEqual(cellFill(4, 5), cellFill(4, 6));
});

test('a fractional camera still covers every overlapping world cell', () => {
  assert.deepEqual(visibleBoardCells({ x: 0, y: 0, columns: 10, rows: 8 }), {
    startX: 0, startY: 0, endX: 10, endY: 8,
  });
  assert.deepEqual(visibleBoardCells({ x: 10.3, y: 4.7, columns: 6, rows: 5 }), {
    startX: 10, startY: 4, endX: 17, endY: 10,
  });
});
