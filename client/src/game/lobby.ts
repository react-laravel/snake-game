export const LOBBY_ROSTER_LIMIT = 5;

export interface LobbyPlayer {
  id: string;
  name: string;
  score: number;
  alive: boolean;
}

export interface LobbyPresence {
  linked: boolean;
  total: number;
  alive: number;
  players: LobbyPlayer[];
}

export function lobbyPresenceCopy(presence: Pick<LobbyPresence, 'linked' | 'total' | 'alive'>): string {
  if (!presence.linked) return '正在连接竞技场…';
  if (presence.total === 0) return '场地空闲，等你加入';
  return `${presence.total} 人在场 · ${presence.alive} 存活`;
}

/** Highest scores first, matching the in-game scoreboard. */
export function lobbyRoster(
  scores: Record<string, { name: string; score: number; alive: boolean }>,
  limit = LOBBY_ROSTER_LIMIT,
): LobbyPlayer[] {
  return Object.entries(scores)
    .map(([id, entry]) => ({ id, name: entry.name, score: entry.score, alive: entry.alive }))
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name) || left.id.localeCompare(right.id))
    .slice(0, Math.max(0, limit));
}

export function lobbyOverflowCopy(total: number, shown: number): string | null {
  const hidden = total - shown;
  return hidden > 0 ? `还有 ${hidden} 人` : null;
}

export function lobbyPlayerStatus(alive: boolean): string {
  return alive ? '对局中' : '已出局';
}
