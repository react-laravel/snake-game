import type { Dir } from '../types/game';

const DIR_OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

export function canQueueDirection(direction: Dir, current: Dir | undefined, pending: Dir[]): boolean {
  if (!current || pending.length >= 2) return false;
  const previous: Dir = pending.length ? pending[pending.length - 1] : current;
  if (previous === direction || DIR_OPPOSITE[previous] === direction) return false;
  return true;
}

export function consumeAppliedTurn(pending: Dir[], previousDir: Dir | undefined, nextDir: Dir | undefined): Dir[] {
  if (!pending.length || !previousDir || !nextDir || previousDir === nextDir) return pending;
  return pending.slice(1);
}
