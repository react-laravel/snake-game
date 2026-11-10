import type { Dir } from '../types/game';

/** Fraction of the stick radius that must be cleared before a heading is read. */
export const JOYSTICK_DEADZONE = 0.25;
/** A new axis must beat the current one by this factor before the heading switches. */
export const JOYSTICK_BIAS = 1.25;

/**
 * Heading for a virtual stick, with a dead zone and diagonal hysteresis so a
 * wobble around 45° does not flip the queued turn.
 */
export function joystickDirection(
  dx: number,
  dy: number,
  maxDistance: number,
  last: Dir | null = null,
  deadzone = JOYSTICK_DEADZONE,
  bias = JOYSTICK_BIAS,
): Dir | null {
  if (!(maxDistance > 0) || !Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  const distance = Math.hypot(dx, dy);
  if (distance <= maxDistance * deadzone) return null;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const horizontal: Dir = dx >= 0 ? 'right' : 'left';
  const vertical: Dir = dy >= 0 ? 'down' : 'up';
  if (last === 'left' || last === 'right') return ay > ax * bias ? vertical : horizontal;
  if (last === 'up' || last === 'down') return ax > ay * bias ? horizontal : vertical;
  return ax >= ay ? horizontal : vertical;
}
