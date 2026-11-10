/** Long enough to read after the disconnect banner goes away. */
export const RESTORE_NOTICE_MS = 2500;

/**
 * Only a mid-session recovery counts: reconnecting or error back to connected.
 * The first join (idle/connecting → connected) and a first paint (null) do not.
 */
export function connectionRestored(previous: string | null, next: string): boolean {
  if (next !== 'connected') return false;
  return previous === 'reconnecting' || previous === 'error';
}

export function restoreCopy(alive: boolean): string {
  return alive ? '连接已恢复，蛇还在场上' : '连接已恢复，积分仍保留';
}
