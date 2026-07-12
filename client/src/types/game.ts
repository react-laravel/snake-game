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

export type ServerMessage =
  | {
      type: 'welcome';
      playerId: string;
      gridWidth: number;
      gridHeight: number;
      reconnectToken?: string;
    }
  | {
      type: 'gameState';
      players: Player[];
      foods: Food[];
      scores: Record<string, ScoreEntry>;
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
    };
