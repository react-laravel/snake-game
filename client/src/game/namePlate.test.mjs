import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('./namePlate.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
});
const { nameCaption, nameTextWidth, namePlateRect, NAME_FONT_SIZE, NAME_PAD_X } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

test('captions mark you, and the drawn width respects the fillText cap', () => {
  assert.equal(nameCaption('红蛇', false), '红蛇');
  assert.equal(nameCaption('红蛇', true), '红蛇 · 你');
  assert.equal(nameTextWidth(80, 120), 80);
  assert.equal(nameTextWidth(200, 120), 120);
  assert.equal(nameTextWidth(50, 0), 0);
});

test('the name plate is centered on the label and covers the baseline', () => {
  const box = namePlateRect(100, 40, 40);
  assert.equal(box.x, 100 - (40 + NAME_PAD_X * 2) / 2);
  assert.equal(box.w, 40 + NAME_PAD_X * 2);
  assert.ok(box.y < 40 && box.y + box.h > 40);
  assert.ok(box.h > NAME_FONT_SIZE);
  const wider = namePlateRect(100, 40, 80);
  assert.ok(wider.w > box.w);
  assert.equal(wider.x + wider.w / 2, 100);
});
