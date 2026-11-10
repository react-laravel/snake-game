/** The longest living snake. Equal lengths keep the earlier id, so a score-sorted list prefers the leader. */
export function longestAliveId(players: Array<{ id: string; alive: boolean; length: number }>) {
  let best: { id: string; length: number } | null = null;
  for (const player of players) {
    if (!player.alive || player.length <= 0) continue;
    if (!best || player.length > best.length) best = { id: player.id, length: player.length };
  }
  return best?.id ?? null;
}
