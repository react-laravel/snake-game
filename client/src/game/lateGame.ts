export function rememberPeakLiving(peakLiving: number, livingCount: number): number {
  return Math.max(peakLiving, Math.max(0, livingCount));
}

export function livingPlayers<T extends { alive: boolean }>(players: T[]): T[] {
  return players.filter((player) => player.alive);
}

/**
 * A late-game moment only after the arena has had at least three living snakes
 * and the field has thinned to three or fewer. A two-person lobby is not a finale.
 */
export function lateGameStatus(input: {
  livingCount: number;
  peakLiving: number;
  selfAlive: boolean;
  soleName?: string | null;
}): { kind: 'solo' | 'duel' | 'late' | null; copy: string | null } {
  const { livingCount, peakLiving, selfAlive, soleName = null } = input;
  if (peakLiving < 3 || livingCount <= 0 || livingCount >= peakLiving || livingCount > 3) {
    return { kind: null, copy: null };
  }
  if (livingCount === 1) {
    if (selfAlive) return { kind: 'solo', copy: '全场只剩你' };
    return { kind: 'solo', copy: soleName ? `只剩 ${soleName} 还在场上` : '还剩 1 人' };
  }
  return {
    kind: livingCount === 2 ? 'duel' : 'late',
    copy: `残局 · 还剩 ${livingCount} 人`,
  };
}

export function shouldRevealAllNames(statusKind: string | null): boolean {
  return statusKind !== null;
}
