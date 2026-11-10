import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('./bodyTaper.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
});
const { bodyTaper, TAPER_SEGMENTS, TAPER_MIN_RATIO } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

test('a short snake keeps a full-width head and a thinner tail', () => {
  assert.equal(bodyTaper(0, 1, 10), 10);
  assert.equal(bodyTaper(0, 3, 10), 10);
  assert.equal(bodyTaper(2, 3, 10), 10 * TAPER_MIN_RATIO);
  assert.ok(bodyTaper(1, 3, 10) > bodyTaper(2, 3, 10));
  assert.ok(bodyTaper(1, 3, 10) < 10);
  assert.equal(bodyTaper(0, 0, 10), 0);
  assert.equal(bodyTaper(0, 4, 0), 0);
});

test('long snakes only taper the tail, and widths never increase toward the tip', () => {
  const max = 12;
  const length = 20;
  const widths = Array.from({ length }, (_, index) => bodyTaper(index, length, max));
  assert.equal(widths[0], max);
  assert.equal(widths[length - 1 - TAPER_SEGMENTS], max);
  assert.equal(widths[length - 1], max * TAPER_MIN_RATIO);
  for (let i = 1; i < length; i++) assert.ok(widths[i] <= widths[i - 1] + 1e-9);
  assert.ok(widths[length - TAPER_SEGMENTS] < max);
});
