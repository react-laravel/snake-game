import type { DeathEvent, JoystickState, ScoreEntry } from '../types/game';
import { DeathFeed } from './DeathFeed';
import { DeathOverlay } from './DeathOverlay';
import { ScoreBadge } from './ScoreBadge';
import { Scoreboard } from './Scoreboard';
import { VirtualJoystick } from './VirtualJoystick';

interface GameHudProps {
  deaths: DeathEvent[];
  isDead: boolean;
  isLandscape: boolean;
  joystick: JoystickState;
  joystickSize: number;
  playerId: string | null;
  score: number;
  sortedScores: Array<[string, ScoreEntry]>;
  onRespawn: () => void;
}

export function GameHud({
  deaths,
  isDead,
  isLandscape,
  joystick,
  joystickSize,
  playerId,
  score,
  sortedScores,
  onRespawn,
}: GameHudProps) {
  return (
    <>
      <VirtualJoystick joystick={joystick} size={joystickSize} />
      {isDead ? <DeathOverlay onRespawn={onRespawn} /> : null}
      <DeathFeed deaths={deaths} />
      <Scoreboard isLandscape={isLandscape} sortedScores={sortedScores} playerId={playerId} />
      <ScoreBadge score={score} />
    </>
  );
}
