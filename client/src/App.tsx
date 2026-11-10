import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
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
import { lateGameStatus, livingPlayers, rememberPeakLiving, shouldRevealAllNames } from './game/lateGame';
import { scoreboardPlace } from './game/lifeStats';
import { createSession, finalizeSession, sessionRecapCopy, trackSession, type SessionAccum } from './game/sessionRecap';
import { pickDeathSpectator, playersForSpectator, spectatorKiller, watchingCopy } from './game/spectator';

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
  const sessionRef = useRef<SessionAccum | null>(null);
  const sessionAliveRef = useRef(false);
  const sessionLatestRef = useRef({ score: 0, foods: 0, kills: 0, maxLength: 0, alive: false });
  const [sessionRecap, setSessionRecap] = useState<string | null>(null);

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

  useEffect(() => {
    if (!game.joined) return;
    if (!sessionRef.current) sessionRef.current = createSession(Date.now());
    const place = scoreboardPlace(game.sortedScores, game.playerId);
    sessionRef.current = trackSession(sessionRef.current, {
      alive: !game.isDead,
      wasAlive: sessionAliveRef.current,
      maxLength: life.maxLength,
      foods: life.foods,
      kills: life.kills,
      rank: place.rank,
    });
    sessionAliveRef.current = !game.isDead;
    sessionLatestRef.current = {
      score: game.myScore,
      foods: life.foods,
      kills: life.kills,
      maxLength: life.maxLength,
      alive: !game.isDead,
    };
  }, [game.isDead, game.joined, game.myScore, game.playerId, game.sortedScores, life.foods, life.kills, life.maxLength]);

  useEffect(() => {
    if (game.joined) {
      setSessionRecap(null);
      return;
    }
    const session = sessionRef.current;
    if (!session) return;
    const copy = sessionRecapCopy(finalizeSession(session, { ...sessionLatestRef.current, nowMs: Date.now() }));
    sessionRef.current = null;
    sessionAliveRef.current = false;
    if (copy) setSessionRecap(copy);
  }, [game.joined]);
  const lobbyLive = useLobbyPresence(!game.joined && game.connectionStatus === 'idle');
  const controls = useGameControls({ enabled: game.joined && !game.isDead && game.connectionStatus === 'connected', joystickSize: JOYSTICK_SIZE, onDirectionChange: game.sendDirection });

  useGameDebugState({ joined: game.joined, isDead: game.isDead, score: game.myScore, playerId: game.playerId, gridSize: game.gridSize, gameState: game.gameState, connectionStatus: game.connectionStatus });

  const spectator = useMemo(() => pickDeathSpectator(
    game.isDead,
    playersForSpectator(game.gameState?.players ?? [], game.sortedScores),
    { ...spectatorKiller(game.deaths, game.playerId), selfId: game.playerId },
  ), [game.deaths, game.gameState?.players, game.isDead, game.playerId, game.sortedScores]);
  const [watchingName, setWatchingName] = useState<string | null>(null);
  const onWatching = useCallback((name: string | null) => setWatchingName(name), []);
  const [runwayHint, setRunwayHint] = useState<string | null>(null);
  const onRunwayHint = useCallback((hint: string | null) => setRunwayHint(hint), []);
  const [peakLiving, setPeakLiving] = useState(0);
  const living = useMemo(() => livingPlayers(game.gameState?.players ?? []), [game.gameState?.players]);
  useEffect(() => {
    if (!game.joined) {
      setPeakLiving(0);
      return;
    }
    setPeakLiving((peak) => rememberPeakLiving(peak, living.length));
  }, [game.joined, living.length]);
  const lateGame = lateGameStatus({
    livingCount: living.length,
    peakLiving,
    selfAlive: !game.isDead && Boolean(living.some((player) => player.id === game.playerId)),
    soleName: living.length === 1 ? living[0].name : null,
  });
  const showAllNames = shouldRevealAllNames(lateGame.kind);
  useEffect(() => {
    if (!game.isDead) setWatchingName(null);
    else setRunwayHint(null);
  }, [game.isDead]);

  const handleJoin = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    game.connect(name);
  };

  return (
    <div className="app-shell">
      {!game.joined ? <JoinScreen name={name} busy={game.connectionStatus === 'connecting' || game.connectionStatus === 'reconnecting'} error={game.connectionError} presence={lobbyLive} personalBest={personalBest} sessionRecap={sessionRecap} onNameChange={setName} onJoin={handleJoin} /> : (
        <GameHud deaths={game.deaths} isDead={game.isDead} life={life} soundOn={soundOn} onToggleSound={() => setSoundOn((value) => { const next = !value; writeSoundEnabled(next); return next; })} joystickActive={controls.active} joystickSize={JOYSTICK_SIZE} joystickVisualRef={controls.visualRef} onJoystickReady={controls.syncVisual} playerId={game.playerId} score={game.myScore} personalBest={personalBest} pendingDirs={game.pendingDirs} gameState={game.gameState} gridSize={game.gridSize} sortedScores={game.sortedScores} frozenPlayerIds={game.frozenPlayerIds} latencyMs={game.latencyMs} onRespawn={game.respawn} onLeave={game.leave} onRetry={game.retry} onDirectionChange={game.sendDirection} connectionStatus={game.connectionStatus} connectionError={game.connectionError} respawning={game.respawning} watchingLabel={watchingCopy(watchingName)} runwayHint={runwayHint} lateGameCopy={lateGame.copy}>
          <GameCanvas gameState={game.gameState} playerId={game.playerId} gridSize={game.gridSize} pendingDirs={game.pendingDirs} isDead={game.isDead} spectator={spectator} onWatching={onWatching} onRunwayHint={onRunwayHint} showAllNames={showAllNames} />
        </GameHud>
      )}
    </div>
  );
}
