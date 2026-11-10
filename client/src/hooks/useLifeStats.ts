import { useEffect, useRef, useState } from 'react';
import { EMPTY_LIFE, nextLifeCounters, scoreboardPlace, type LifeCounters } from '../game/lifeStats';
import type { DeathEvent, GameState, ScoreEntry } from '../types/game';

function sortedScores(scores: Record<string, ScoreEntry> | undefined) {
  return Object.entries(scores ?? {}).sort((left, right) => right[1].score - left[1].score ||
    left[1].name.localeCompare(right[1].name) || left[0].localeCompare(right[0]));
}

export function useLifeStats(input: {
  joined: boolean;
  playerId: string | null;
  gameState: GameState | null;
  deaths: DeathEvent[];
}) {
  const [stats, setStats] = useState<LifeCounters>(EMPTY_LIFE);
  const countersRef = useRef<LifeCounters>(EMPTY_LIFE);
  const wasAliveRef = useRef(false);
  const lengthRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const seenDeathsRef = useRef(new Set<string>());

  useEffect(() => {
    if (!input.joined || !input.playerId) {
      countersRef.current = EMPTY_LIFE;
      wasAliveRef.current = false;
      lengthRef.current = null;
      startedAtRef.current = null;
      seenDeathsRef.current.clear();
      setStats(EMPTY_LIFE);
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
    const place = scoreboardPlace(sortedScores(input.gameState?.scores), input.playerId);
    const next = nextLifeCounters(countersRef.current, {
      alive,
      wasAlive: wasAliveRef.current,
      length,
      previousLength: lengthRef.current,
      newKills,
      nowMs: Date.now(),
      startedAt: startedAtRef.current,
      rank: place.rank,
      fieldSize: place.fieldSize,
    });
    countersRef.current = next.counters;
    lengthRef.current = next.previousLength;
    startedAtRef.current = next.startedAt;
    wasAliveRef.current = alive;
    setStats(next.counters);
  }, [input.deaths, input.gameState, input.joined, input.playerId]);

  return stats;
}
