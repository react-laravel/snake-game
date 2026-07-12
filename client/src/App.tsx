import { useState, type FormEvent } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { GameHud } from './components/GameHud';
import { JoinScreen } from './components/JoinScreen';
import { JOYSTICK_SIZE } from './game/constants';
import { useGameConnection } from './hooks/useGameConnection';
import { useGameControls } from './hooks/useGameControls';
import { useGameDebugState } from './hooks/useGameDebugState';
import { useViewportOrientation } from './hooks/useViewportOrientation';

export default function App() {
  const [name, setName] = useState('');
  const isLandscape = useViewportOrientation();
  const game = useGameConnection();
  const joystick = useGameControls({
    enabled: game.joined && !game.isDead,
    joystickSize: JOYSTICK_SIZE,
    onDirectionChange: game.sendDirection,
  });

  useGameDebugState({
    joined: game.joined,
    isDead: game.isDead,
    score: game.myScore,
    playerId: game.playerId,
    gridSize: game.gridSize,
    gameState: game.gameState,
  });

  const handleJoin = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    game.connect(name);
  };

  return (
    <div className="app-shell">
      {!game.joined ? (
        <JoinScreen name={name} onNameChange={setName} onJoin={handleJoin} />
      ) : (
        <>
          <GameCanvas gameState={game.gameState} playerId={game.playerId} gridSize={game.gridSize} />
          <GameHud
            deaths={game.deaths}
            isDead={game.isDead}
            isLandscape={isLandscape}
            joystick={joystick}
            joystickSize={JOYSTICK_SIZE}
            playerId={game.playerId}
            score={game.myScore}
            sortedScores={game.sortedScores}
            onRespawn={game.respawn}
          />
        </>
      )}
    </div>
  );
}
