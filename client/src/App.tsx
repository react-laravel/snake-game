import { useState, type FormEvent } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { GameHud } from './components/GameHud';
import { JoinScreen } from './components/JoinScreen';
import { JOYSTICK_SIZE } from './game/constants';
import { useGameConnection } from './hooks/useGameConnection';
import { useGameControls } from './hooks/useGameControls';
import { useGameDebugState } from './hooks/useGameDebugState';

function savedName() {
  try { return localStorage.getItem('snake_name') || ''; } catch { return ''; }
}

export default function App() {
  const [name, setName] = useState(savedName);
  const game = useGameConnection();
  const controls = useGameControls({ enabled: game.joined && !game.isDead && game.connectionStatus === 'connected', joystickSize: JOYSTICK_SIZE, onDirectionChange: game.sendDirection });

  useGameDebugState({ joined: game.joined, isDead: game.isDead, score: game.myScore, playerId: game.playerId, gridSize: game.gridSize, gameState: game.gameState, connectionStatus: game.connectionStatus });

  const handleJoin = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    game.connect(name);
  };

  return (
    <div className="app-shell">
      {!game.joined ? <JoinScreen name={name} busy={game.connectionStatus === 'connecting' || game.connectionStatus === 'reconnecting'} error={game.connectionError} onNameChange={setName} onJoin={handleJoin} /> : (
        <GameHud deaths={game.deaths} isDead={game.isDead} joystickActive={controls.active} joystickSize={JOYSTICK_SIZE} joystickVisualRef={controls.visualRef} onJoystickReady={controls.syncVisual} playerId={game.playerId} score={game.myScore} sortedScores={game.sortedScores} onRespawn={game.respawn} onLeave={game.leave} onRetry={game.retry} onDirectionChange={game.sendDirection} connectionStatus={game.connectionStatus} connectionError={game.connectionError} respawning={game.respawning}>
          <GameCanvas gameState={game.gameState} playerId={game.playerId} gridSize={game.gridSize} />
        </GameHud>
      )}
    </div>
  );
}
