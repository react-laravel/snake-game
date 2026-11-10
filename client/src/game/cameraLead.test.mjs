import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('./cameraLead.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
});
const { cameraLeadCells, cameraLeadDir, cameraLeadFocus, CAMERA_LEAD_FRACTION, CAMERA_LEAD_MARGIN } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

test('lead cells stay inside a trailing margin so the head remains on screen', () => {
  assert.equal(cameraLeadCells(1), 0);
  assert.equal(cameraLeadCells(4), 0);
  assert.equal(cameraLeadCells(8), 2);
  assert.equal(cameraLeadCells(20), Math.round(19 * CAMERA_LEAD_FRACTION));
  assert.ok(cameraLeadCells(20) <= Math.floor(20 / 2) - CAMERA_LEAD_MARGIN);
  assert.ok(cameraLeadCells(21) <= Math.floor(21 / 2) - CAMERA_LEAD_MARGIN);
});

test('the follow point shifts forward, and a queued turn wins over the current heading', () => {
  const head = { x: 10, y: 10 };
  const view = { columns: 21, rows: 15 };
  assert.deepEqual(cameraLeadFocus(head, undefined, view), head);
  assert.deepEqual(cameraLeadFocus(head, 'right', view), { x: 10 + cameraLeadCells(21), y: 10 });
  assert.deepEqual(cameraLeadFocus(head, 'left', view), { x: 10 - cameraLeadCells(21), y: 10 });
  assert.deepEqual(cameraLeadFocus(head, 'up', view), { x: 10, y: 10 - cameraLeadCells(15) });
  assert.deepEqual(cameraLeadFocus(head, 'down', view), { x: 10, y: 10 + cameraLeadCells(15) });
  assert.equal(cameraLeadDir('right', []), 'right');
  assert.equal(cameraLeadDir('right', ['up', 'left']), 'left');
  assert.equal(cameraLeadDir(undefined, []), undefined);
});
