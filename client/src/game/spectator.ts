import { longestAliveId } from './longest';

export interface SpectatorPlayer {
  id: string;
  name: string;
  alive: boolean;
  length: number;
}

/** Keep scoreboard order so equal lengths still prefer the leader. */
export function playersForSpectator(
  players: Array<{ id: string; name: string; alive: boolean; snake: { length: number } }>,
  scoreOrder: Array<[string, unknown] | string>,
): SpectatorPlayer[] {
  const ids = scoreOrder.map((entry) => (Array.isArray(entry) ? entry[0] : entry));
  const byId = new Map(players.map((player) => [player.id, {
    id: player.id,
    name: player.name,
    alive: player.alive,
    length: player.snake.length,
  }]));
  const seen = new Set<string>();
  const ordered: SpectatorPlayer[] = [];
  for (const id of ids) {
    const player = byId.get(id);
    if (!player || seen.has(id)) continue;
    seen.add(id);
    ordered.push(player);
  }
  for (const player of byId.values()) {
    if (seen.has(player.id)) continue;
    ordered.push(player);
  }
  return ordered;
}

/** The most recent death record for this player, including a youDied fallback victim of "you". */
export function spectatorKiller(
  deaths: Array<{ victim: string; killer: string | null; killerName: string | null }>,
  playerId: string | null,
): { killerId: string | null; killerName: string | null } {
  if (!playerId) return { killerId: null, killerName: null };
  let fallback: { killerId: string | null; killerName: string | null } | null = null;
  for (let index = deaths.length - 1; index >= 0; index--) {
    const event = deaths[index];
    if (event.victim === playerId) return { killerId: event.killer, killerName: event.killerName };
    if (event.victim === 'you' && !fallback) fallback = { killerId: event.killer, killerName: event.killerName };
  }
  return fallback ?? { killerId: null, killerName: null };
}

/**
 * After death, follow the killer if they are still alive; otherwise the longest
 * living snake. Equal lengths keep the earlier id, so a score-sorted list prefers
 * the leaderboard leader.
 */
export function pickDeathSpectator(
  isDead: boolean,
  players: SpectatorPlayer[],
  options: { killerId?: string | null; killerName?: string | null; selfId?: string | null } = {},
): { id: string; name: string } | null {
  if (!isDead) return null;
  const selfId = options.selfId ?? null;
  const living = players.filter((player) => player.alive && player.length > 0 && player.id !== selfId);
  if (!living.length) return null;

  const byId = new Map(living.map((player) => [player.id, player]));
  if (options.killerId) {
    const killer = byId.get(options.killerId);
    if (killer) return { id: killer.id, name: killer.name };
  }

  if (options.killerName) {
    const named = living.filter((player) => player.name === options.killerName);
    const chosenId = named.length === 1 ? named[0].id : longestAliveId(named);
    const chosen = named.find((player) => player.id === chosenId);
    if (chosen) return { id: chosen.id, name: chosen.name };
  }

  const id = longestAliveId(living);
  const chosen = living.find((player) => player.id === id);
  return chosen ? { id: chosen.id, name: chosen.name } : null;
}

/** A cropped death view follows the spectator target; a full board or a living self does not. */
export function cameraFollowId(isDead: boolean, cropped: boolean, spectatorId: string | null): string | null {
  return isDead && cropped && spectatorId ? spectatorId : null;
}

export function watchingCopy(name: string | null | undefined): string | null {
  return name ? `正在观看 ${name}` : null;
}
