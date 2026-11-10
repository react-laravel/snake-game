import { useEffect, useRef, useState } from 'react';
import { nextLifeCounters, type LifeCounters } from '../game/lifeStats';
import type { DeathEvent, GameState } from '../types/game';

const EMPTY: LifeCounters = { foods: 0, kills: 0 };

export function useLifeStats(input: {
  joined: boolean;
  playerId: string | null;
  gameState: GameState | null;
  deaths: DeathEvent[];
}) {
  const [stats, setStats] = useState<LifeCounters>(EMPTY);
  const countersRef = useRef<LifeCounters>(EMPTY);
  const wasAliveRef = useRef(false);
  const lengthRef = useRef<number | null>(null);
  const seenDeathsRef = useRef(new Set<string>());

  useEffect(() => {
    if (!input.joined || !input.playerId) {
      countersRef.current = EMPTY;
      wasAliveRef.current = false;
      lengthRef.current = null;
      seenDeathsRef.current.clear();
      setStats(EMPTY);
      return;
    }
    const me = input.gameState?.players.find((player) => player.id === input.playerId);
    const alive = Boolean(me?.alive);
    const length = me?.snake.length ?? 0;
    let newKills = 0;
    for (const death of input.deaths) {
      if (seenDeathsRef.current.has(death.id)) continue;
      seenDeathsRef.current.add(death.id);
      if (death.killer === input.playerId && death.scoringKill && wasAliveRef.current) newKills += 1;
    }
    const next = nextLifeCounters(countersRef.current, {
      alive,
      wasAlive: wasAliveRef.current,
      length,
      previousLength: lengthRef.current,
      newKills,
    });
    countersRef.current = next.counters;
    lengthRef.current = next.previousLength;
    wasAliveRef.current = alive;
    setStats(next.counters);
  }, [input.deaths, input.gameState, input.joined, input.playerId]);

  return stats;
}
