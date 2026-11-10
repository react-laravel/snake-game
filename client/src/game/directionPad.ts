import type { Dir } from '../types/game';

export type PadButtonKind = 'idle' | 'current' | 'queued';

/**
 * How a direction-pad button should look: the live heading, the next queued
 * turn, or neither. The first pending turn wins when it overlaps the heading.
 */
export function padButtonKind(
  button: Dir,
  current: Dir | null | undefined,
  pending: readonly Dir[] = [],
): PadButtonKind {
  if (pending[0] === button) return 'queued';
  if (current === button) return 'current';
  return 'idle';
}

/** Class suffix for a pad button, including the leading space when marked. */
export function padButtonClass(kind: PadButtonKind): string {
  return kind === 'idle' ? '' : ` direction-${kind}`;
}
