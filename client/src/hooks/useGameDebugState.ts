import { useEffect, useRef } from 'react';
import type { GameState, GridSize } from '../types/game';

interface GameDebugState {
  joined: boolean;
  isDead: boolean;
  score: number;
  playerId: string | null;
  gridSize: GridSize;
  gameState: GameState | null;
}

export function useGameDebugState(state: GameDebugState) {
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const renderGameToText = () => {
      const current = stateRef.current;
      const player = current.gameState?.players.find((entry) => entry.id === current.playerId) ?? null;

      return JSON.stringify({
        coordinateSystem: 'grid origin is top-left; x increases right; y increases down',
        mode: !current.joined ? 'join' : current.isDead ? 'dead' : 'playing',
        grid: current.gridSize,
        player: player
          ? { id: player.id, head: player.snake[0] ?? null, length: player.snake.length, alive: player.alive }
          : null,
        foods: current.gameState?.foods ?? [],
        opponents:
          current.gameState?.players
            .filter((entry) => entry.id !== current.playerId && entry.alive)
            .map((entry) => ({ id: entry.id, name: entry.name, head: entry.snake[0] ?? null, length: entry.snake.length })) ?? [],
        score: current.score,
      });
    };

    window.render_game_to_text = renderGameToText;
    return () => {
      if (window.render_game_to_text === renderGameToText) delete window.render_game_to_text;
    };
  }, []);
}
