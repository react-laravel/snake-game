import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('./joystick.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
});
const { joystickDirection, JOYSTICK_DEADZONE, JOYSTICK_BIAS } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

test('the dead zone stays silent, and the first heading follows the dominant axis', () => {
  assert.equal(joystickDirection(0, 0, 100, null), null);
  assert.equal(joystickDirection(100 * JOYSTICK_DEADZONE, 0, 100, null), null);
  assert.equal(joystickDirection(100 * JOYSTICK_DEADZONE + 1, 0, 100, null), 'right');
  assert.equal(joystickDirection(-40, 10, 100, null), 'left');
  assert.equal(joystickDirection(10, 40, 100, null), 'down');
  assert.equal(joystickDirection(10, -40, 100, null), 'up');
  assert.equal(joystickDirection(30, 30, 100, null), 'right');
  assert.equal(joystickDirection(0, 0, 0, 'right'), null);
});

test('a held heading ignores a slight diagonal wobble until the other axis clearly wins', () => {
  assert.equal(joystickDirection(40, 40, 100, 'right'), 'right');
  assert.equal(joystickDirection(40, 40 * JOYSTICK_BIAS, 100, 'right'), 'right');
  assert.equal(joystickDirection(40, 40 * JOYSTICK_BIAS + 1, 100, 'right'), 'down');
  assert.equal(joystickDirection(-40, 10, 100, 'right'), 'left');
  assert.equal(joystickDirection(20, -40, 100, 'up'), 'up');
  assert.equal(joystickDirection(40 * JOYSTICK_BIAS + 1, -40, 100, 'up'), 'right');
});
