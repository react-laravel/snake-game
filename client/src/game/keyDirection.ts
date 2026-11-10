import type { Dir } from '../types/game';

const KEY_DIRECTIONS: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};

const CODE_DIRECTIONS: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
};

/**
 * Prefer physical WASD positions (`event.code`) so the same key cluster works
 * on AZERTY and similar layouts, then fall back to the letter or arrow `key`.
 */
export function keyDirection(key: string, code = ''): Dir | null {
  return CODE_DIRECTIONS[code] ?? KEY_DIRECTIONS[key] ?? KEY_DIRECTIONS[key.toLowerCase()] ?? null;
}
