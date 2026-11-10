import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('./foodMark.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
});
const { foodRadii, foodHighlightOffset, foodColors, minimapFoodRadius } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

test('pellets stay visible on small cells and the nearest food is larger with a ring', () => {
  const regular = foodRadii(8, false);
  const nearest = foodRadii(8, true);
  assert.ok(regular.fill >= 2.7);
  assert.ok(nearest.fill > regular.fill);
  assert.equal(regular.ring, null);
  assert.ok(nearest.ring !== null && nearest.ring > nearest.fill);
  assert.ok(regular.highlight < regular.fill);
  const wide = foodRadii(20, false);
  assert.ok(wide.fill > regular.fill);
  const offset = foodHighlightOffset(10);
  assert.ok(Math.abs(offset.x + 2.8) < 1e-9);
  assert.ok(Math.abs(offset.y + 2.8) < 1e-9);
  assert.ok(offset.x < 0 && offset.y < 0);
  assert.notEqual(foodColors(false).body, foodColors(true).body);
});

test('minimap food marks scale up for the nearest pellet', () => {
  assert.ok(minimapFoodRadius(2, true) > minimapFoodRadius(2, false));
  assert.ok(minimapFoodRadius(0.5, false) >= 1.4);
});
