import { useEffect, useRef, useState, type FormEvent } from 'react';
import { readPersonalBest, updatePersonalBest } from './game/personalBest';
import { playCue, readSoundEnabled, writeSoundEnabled } from './game/sound';
import { GameCanvas } from './components/GameCanvas';
import { GameHud } from './components/GameHud';
import { JoinScreen } from './components/JoinScreen';
import { JOYSTICK_SIZE } from './game/constants';
import { useGameConnection } from './hooks/useGameConnection';
import { useGameControls } from './hooks/useGameControls';
import { useGameDebugState } from './hooks/useGameDebugState';
import { useLifeStats } from './hooks/useLifeStats';
import { useLobbyPresence } from './hooks/useLobbyPresence';

function savedName() {
  try { return localStorage.getItem('snake_name') || ''; } catch { return ''; }
}

export default function App() {
  const [name, setName] = useState(savedName);
  const [personalBest, setPersonalBest] = useState(readPersonalBest);
  const [soundOn, setSoundOn] = useState(readSoundEnabled);
  const game = useGameConnection();
  const life = useLifeStats({ joined: game.joined, playerId: game.playerId, gameState: game.gameState, deaths: game.deaths });
  const cueRef = useRef({ foods: 0, kills: 0, dead: false });

  useEffect(() => {
    if (!soundOn || !game.joined) {
      cueRef.current = { foods: life.foods, kills: life.kills, dead: game.isDead };
      return;
    }
    if (life.foods > cueRef.current.foods) playCue('eat');
    if (life.kills > cueRef.current.kills) playCue('kill');
    if (game.isDead && !cueRef.current.dead) playCue('die');
    cueRef.current = { foods: life.foods, kills: life.kills, dead: game.isDead };
  }, [game.isDead, game.joined, life.foods, life.kills, soundOn]);

  useEffect(() => {
    if (!game.joined) return;
    setPersonalBest(updatePersonalBest(game.myScore));
  }, [game.joined, game.myScore]);
  const lobbyLive = useLobbyPresence(!game.joined && game.connectionStatus === 'idle');
  const controls = useGameControls({ enabled: game.joined && !game.isDead && game.connectionStatus === 'connected', joystickSize: JOYSTICK_SIZE, onDirectionChange: game.sendDirection });

  useGameDebugState({ joined: game.joined, isDead: game.isDead, score: game.myScore, playerId: game.playerId, gridSize: game.gridSize, gameState: game.gameState, connectionStatus: game.connectionStatus });

  const handleJoin = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    game.connect(name);
  };

  return (
    <div className="app-shell">
      {!game.joined ? <JoinScreen name={name} busy={game.connectionStatus === 'connecting' || game.connectionStatus === 'reconnecting'} error={game.connectionError} presence={lobbyLive} personalBest={personalBest} onNameChange={setName} onJoin={handleJoin} /> : (
        <GameHud deaths={game.deaths} isDead={game.isDead} life={life} soundOn={soundOn} onToggleSound={() => setSoundOn((value) => { const next = !value; writeSoundEnabled(next); return next; })} joystickActive={controls.active} joystickSize={JOYSTICK_SIZE} joystickVisualRef={controls.visualRef} onJoystickReady={controls.syncVisual} playerId={game.playerId} score={game.myScore} personalBest={personalBest} pendingDirs={game.pendingDirs} gameState={game.gameState} gridSize={game.gridSize} sortedScores={game.sortedScores} frozenPlayerIds={game.frozenPlayerIds} latencyMs={game.latencyMs} onRespawn={game.respawn} onLeave={game.leave} onRetry={game.retry} onDirectionChange={game.sendDirection} connectionStatus={game.connectionStatus} connectionError={game.connectionError} respawning={game.respawning}>
          <GameCanvas gameState={game.gameState} playerId={game.playerId} gridSize={game.gridSize} pendingDirs={game.pendingDirs} />
        </GameHud>
      )}
    </div>
  );
}
