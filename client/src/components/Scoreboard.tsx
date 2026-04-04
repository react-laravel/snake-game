import type { ScoreEntry } from '../types/game';

interface ScoreboardProps {
  isLandscape: boolean;
  sortedScores: Array<[string, ScoreEntry]>;
  playerId: string | null;
}

export function Scoreboard({ isLandscape, sortedScores, playerId }: ScoreboardProps) {
  return (
    <div
      className={`scoreboard ${isLandscape ? 'scoreboard-landscape' : 'scoreboard-portrait'}`}
      data-no-joystick
    >
      <div className="scoreboard-title">排行榜</div>
      <div className="scoreboard-list">
        {sortedScores.map(([id, entry], index) => {
          const isSelf = id === playerId;
          return (
            <div key={id} className={`score-row ${isSelf ? 'score-row-self' : ''}`}>
              <span className="score-rank">{index + 1}</span>
              <span className="score-name">
                {entry.name}
                {isSelf ? ' (我)' : ''}
                {!entry.alive ? <span className="score-dead"> DEAD</span> : null}
              </span>
              <span className={`score-points ${entry.alive ? 'score-alive' : 'score-faded'}`}>{entry.score}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
