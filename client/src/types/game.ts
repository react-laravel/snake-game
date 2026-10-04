export interface SnakeSegment {
  x: number;
  y: number;
}

export interface Player {
  id: string;
  name: string;
  snake: SnakeSegment[];
  alive: boolean;
  color: string;
  dir?: Dir;
}

export interface Food {
  id: string;
  x: number;
  y: number;
}

export interface ScoreEntry {
  score: number;
  name: string;
  alive: boolean;
}

export interface GameState {
  players: Player[];
  foods: Food[];
  scores: Record<string, ScoreEntry>;
  seq?: number;
  tickMs?: number;
}

export interface GridSize {
  w: number;
  h: number;
}

export interface DeathEvent {
  id: string;
  victim: string;
  victimName: string;
  killer: string | null;
  killerName: string | null;
}

export interface JoystickState {
  active: boolean;
  dx: number;
  dy: number;
  baseX: number;
  baseY: number;
}

export type Dir = 'up' | 'down' | 'left' | 'right';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export type ServerMessage =
  | {
      type: 'welcome';
      playerId: string;
      gridWidth: number;
      gridHeight: number;
      reconnectToken?: string;
      alive?: boolean;
      dir?: Dir;
      score?: number;
      tickMs?: number;
    }
  | {
      type: 'gameState';
      players: Player[];
      foods: Food[];
      scores: Record<string, ScoreEntry>;
      seq?: number;
      tickMs?: number;
    }
  | {
      type: 'playerDied';
      victim: string;
      victimName: string;
      killer: string | null;
      killerName: string | null;
    }
  | {
      type: 'youDied';
      killerName: string | null;
    }
  | {
      type: 'error';
      code: string;
      message?: string;
    };
