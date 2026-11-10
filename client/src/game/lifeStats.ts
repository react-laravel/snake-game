export interface LifeCounters {
  foods: number;
  kills: number;
  survivedMs: number;
  maxLength: number;
  rank: number | null;
  fieldSize: number;
}

export const EMPTY_LIFE: LifeCounters = {
  foods: 0,
  kills: 0,
  survivedMs: 0,
  maxLength: 0,
  rank: null,
  fieldSize: 0,
};

export function nextLifeCounters(
  current: LifeCounters,
  input: {
    alive: boolean;
    wasAlive: boolean;
    length: number;
    previousLength: number | null;
    newKills: number;
    nowMs: number;
    startedAt: number | null;
    rank: number | null;
    fieldSize: number;
  },
): { counters: LifeCounters; previousLength: number | null; startedAt: number | null } {
  if (input.alive && !input.wasAlive) {
    return {
      counters: {
        foods: 0,
        kills: 0,
        survivedMs: 0,
        maxLength: input.length,
        rank: input.rank,
        fieldSize: input.fieldSize,
      },
      previousLength: input.length,
      startedAt: input.nowMs,
    };
  }
  if (!input.alive) {
    if (!input.wasAlive) return { counters: current, previousLength: null, startedAt: input.startedAt };
    const startedAt = input.startedAt ?? input.nowMs;
    return {
      counters: {
        ...current,
        survivedMs: Math.max(0, input.nowMs - startedAt),
        maxLength: Math.max(current.maxLength, input.previousLength ?? 0),
        rank: input.rank,
        fieldSize: input.fieldSize,
      },
      previousLength: null,
      startedAt,
    };
  }
  const grown = input.previousLength === null ? 0 : Math.max(0, input.length - input.previousLength);
  const startedAt = input.startedAt ?? input.nowMs;
  return {
    counters: {
      foods: current.foods + grown,
      kills: current.kills + input.newKills,
      survivedMs: Math.max(0, input.nowMs - startedAt),
      maxLength: Math.max(current.maxLength, input.length),
      rank: input.rank,
      fieldSize: input.fieldSize,
    },
    previousLength: input.length,
    startedAt,
  };
}

export function scoreboardPlace(
  sorted: Array<[string, unknown]>,
  playerId: string | null,
): { rank: number | null; fieldSize: number } {
  const fieldSize = sorted.length;
  if (!playerId) return { rank: null, fieldSize };
  const index = sorted.findIndex(([id]) => id === playerId);
  return { rank: index >= 0 ? index + 1 : null, fieldSize };
}

export function formatSurvived(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `存活 ${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `存活 ${minutes} 分` : `存活 ${minutes} 分 ${rest} 秒`;
}

/** A compact recap of one life: time, peak length, and rank at the end. */
export function lifeRecapCopy(life: Pick<LifeCounters, 'survivedMs' | 'maxLength' | 'rank' | 'fieldSize'>): string | null {
  const parts = [formatSurvived(life.survivedMs)];
  if (life.maxLength > 0) parts.push(`${life.maxLength} 节`);
  if (life.rank !== null && life.fieldSize > 0) parts.push(`第 ${life.rank} / ${life.fieldSize} 名`);
  return parts.join(' · ');
}
