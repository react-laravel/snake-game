export interface SessionAccum {
  startedAt: number;
  lives: number;
  maxLength: number;
  bankedFoods: number;
  bankedKills: number;
  bestRank: number | null;
  sawDeath: boolean;
}

export interface SessionStats {
  score: number;
  lives: number;
  maxLength: number;
  foods: number;
  kills: number;
  durationMs: number;
  bestRank: number | null;
}

export function createSession(nowMs: number): SessionAccum {
  return { startedAt: nowMs, lives: 0, maxLength: 0, bankedFoods: 0, bankedKills: 0, bestRank: null, sawDeath: false };
}

export function trackSession(session: SessionAccum, input: {
  alive: boolean;
  wasAlive: boolean;
  maxLength: number;
  foods: number;
  kills: number;
  rank: number | null;
}): SessionAccum {
  const next = { ...session };
  if (input.alive && !input.wasAlive) {
    next.lives += 1;
    next.sawDeath = false;
  }
  next.maxLength = Math.max(next.maxLength, input.maxLength);
  if (input.alive && input.rank !== null) {
    next.bestRank = next.bestRank === null ? input.rank : Math.min(next.bestRank, input.rank);
  }
  if (!input.alive && input.wasAlive && !session.sawDeath) {
    next.bankedFoods += input.foods;
    next.bankedKills += input.kills;
    next.sawDeath = true;
  }
  return next;
}

export function finalizeSession(session: SessionAccum, input: {
  score: number;
  nowMs: number;
  foods: number;
  kills: number;
  maxLength: number;
  alive: boolean;
}): SessionStats {
  return {
    score: input.score,
    lives: session.lives,
    maxLength: Math.max(session.maxLength, input.maxLength),
    foods: session.bankedFoods + (input.alive ? input.foods : 0),
    kills: session.bankedKills + (input.alive ? input.kills : 0),
    durationMs: Math.max(0, input.nowMs - session.startedAt),
    bestRank: session.bestRank,
  };
}

export function formatSessionTime(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes} 分` : `${minutes} 分 ${rest} 秒`;
}

export function isMeaningfulSession(stats: SessionStats): boolean {
  return stats.lives > 0 || stats.score > 0 || stats.durationMs >= 1000 || stats.kills > 0 || stats.maxLength > 0;
}

export function sessionRecapCopy(stats: SessionStats): string | null {
  if (!isMeaningfulSession(stats)) return null;
  const parts = [`积分 ${stats.score}`, formatSessionTime(stats.durationMs)];
  if (stats.lives > 0) parts.push(`${stats.lives} 条命`);
  if (stats.maxLength > 0) parts.push(`最长 ${stats.maxLength} 节`);
  if (stats.foods > 0) parts.push(`食物 ${stats.foods}`);
  if (stats.kills > 0) parts.push(`击杀 ${stats.kills}`);
  if (stats.bestRank !== null) parts.push(`最好第 ${stats.bestRank} 名`);
  return `上一局 · ${parts.join(' · ')}`;
}
