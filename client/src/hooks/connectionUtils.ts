import type { Dir, ScoreEntry, ServerMessage } from '../types/game';

export const MAX_RECONNECT_ATTEMPTS = 5;

export function reconnectDelay(attempt: number) {
  return Math.min(500 * 2 ** Math.max(0, attempt), 8000);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDirection(value: unknown): value is Dir {
  return value === 'up' || value === 'down' || value === 'left' || value === 'right';
}

function isPosition(value: unknown) {
  return isRecord(value) && Number.isInteger(value.x) && Number.isInteger(value.y);
}

function isNullableString(value: unknown) {
  return value === null || typeof value === 'string';
}

// A malformed frame must not crash the game or replace the last valid board.
export function parseServerMessage(data: unknown): ServerMessage | null {
  if (typeof data !== 'string') return null;
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;

  switch (value.type) {
    case 'welcome':
      if (typeof value.playerId !== 'string' || !value.playerId ||
          !Number.isInteger(value.gridWidth) || Number(value.gridWidth) <= 0 ||
          !Number.isInteger(value.gridHeight) || Number(value.gridHeight) <= 0 ||
          (value.reconnectToken !== undefined && typeof value.reconnectToken !== 'string') ||
          (value.alive !== undefined && typeof value.alive !== 'boolean') ||
          (value.dir !== undefined && !isDirection(value.dir))) return null;
      break;
    case 'gameState':
      if (!Array.isArray(value.players) || !Array.isArray(value.foods) || !isRecord(value.scores)) return null;
      if (!value.players.every((player) => isRecord(player) &&
          typeof player.id === 'string' && typeof player.name === 'string' &&
          typeof player.color === 'string' && typeof player.alive === 'boolean' &&
          Array.isArray(player.snake) && player.snake.every(isPosition) &&
          (player.dir === undefined || isDirection(player.dir)))) return null;
      if (!value.foods.every((food) => isRecord(food) && typeof food.id === 'string' && isPosition(food))) return null;
      if (!Object.values(value.scores).every((score) => isRecord(score) &&
          typeof score.score === 'number' && Number.isFinite(score.score) &&
          typeof score.name === 'string' && typeof score.alive === 'boolean')) return null;
      break;
    case 'playerDied':
      if (typeof value.victim !== 'string' || typeof value.victimName !== 'string' ||
          !isNullableString(value.killer) || !isNullableString(value.killerName)) return null;
      break;
    case 'youDied':
      if (!isNullableString(value.killerName)) return null;
      break;
    case 'error':
      if (typeof value.code !== 'string' ||
          (value.message !== undefined && typeof value.message !== 'string')) return null;
      break;
    default:
      return null;
  }
  return value as ServerMessage;
}

export function reuseScores(
  previous: Record<string, ScoreEntry> | undefined,
  next: Record<string, ScoreEntry>,
) {
  if (!previous || Object.keys(previous).length !== Object.keys(next).length) return next;
  return Object.entries(next).every(([id, entry]) => previous[id]?.score === entry.score &&
    previous[id]?.name === entry.name && previous[id]?.alive === entry.alive) ? previous : next;
}

export function readStored(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // The game remains playable when browser storage is disabled or full.
  }
}
