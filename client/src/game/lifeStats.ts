export interface LifeCounters {
  foods: number;
  kills: number;
}

export function nextLifeCounters(
  current: LifeCounters,
  input: {
    alive: boolean;
    wasAlive: boolean;
    length: number;
    previousLength: number | null;
    newKills: number;
  },
): { counters: LifeCounters; previousLength: number | null } {
  if (input.alive && !input.wasAlive) {
    return { counters: { foods: 0, kills: 0 }, previousLength: input.length };
  }
  if (!input.alive) return { counters: current, previousLength: null };
  const grown = input.previousLength === null ? 0 : Math.max(0, input.length - input.previousLength);
  return {
    counters: { foods: current.foods + grown, kills: current.kills + input.newKills },
    previousLength: input.length,
  };
}
