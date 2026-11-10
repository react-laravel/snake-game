import { memo, useState } from 'react';
import { longestAliveId } from '../game/longest';
import type { ScoreEntry } from '../types/game';

interface ScoreboardProps {
  sortedScores: Array<[string, ScoreEntry]>;
  playerId: string | null;
  frozenPlayerIds: Set<string>;
  lengths: Map<string, number>;
}

function playerStatus(id: string, entry: ScoreEntry, frozenPlayerIds: Set<string>, length: number) {
  const state = !entry.alive ? '已出局' : frozenPlayerIds.has(id) ? '断线中' : '对局中';
  return length > 0 ? `${state} · ${length} 节` : state;
}

export const Scoreboard = memo(function Scoreboard({ sortedScores, playerId, frozenPlayerIds, lengths }: ScoreboardProps) {
  const [expanded, setExpanded] = useState(false);
  const aliveCount = sortedScores.filter(([, entry]) => entry.alive).length;
  const longestId = longestAliveId(sortedScores.map(([id, entry]) => ({ id, alive: entry.alive, length: lengths.get(id) ?? 0 })));

  return (
    <aside className={`scoreboard ${expanded ? 'scoreboard-expanded' : ''}`} data-no-joystick aria-label="排行榜">
      <div className="scoreboard-heading"><div><span className="eyebrow">LEADERBOARD</span><h2>场上排名</h2></div><span className="player-count">{aliveCount} 存活</span></div>
      <button className="scoreboard-toggle" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-controls="scoreboard-list">排行榜 <span>{aliveCount} 人存活 · {expanded ? '收起 −' : '展开 +'}</span></button>
      <div id="scoreboard-list" className="scoreboard-list">
        <div className="scoreboard-columns"><span>玩家</span><span>积分</span></div>
        {sortedScores.length === 0 && <p className="scoreboard-empty">等待玩家加入…</p>}
        {sortedScores.map(([id, entry], index) => (
          <div key={id} className={`score-row ${id === playerId ? 'score-row-self' : ''} ${id === longestId ? 'score-row-long' : ''}`}>
            <span className="score-rank">{String(index + 1).padStart(2, '0')}</span>
            <span className="score-identity"><span className="score-name" title={entry.name}><span className="score-name-text">{entry.name}</span>{id === playerId && <small>你</small>}{id === longestId && <small>最长</small>}</span><span className="score-player-status">{playerStatus(id, entry, frozenPlayerIds, lengths.get(id) ?? 0)}</span></span>
            <span className={`score-points ${!entry.alive ? 'score-faded' : ''}`}>{entry.score}</span>
          </div>
        ))}
      </div>
      <div className="scoreboard-note"><span>生存是第一要务。</span><p>蛇会持续前进，提前转弯。<br />积分在复活后保留。</p><div><kbd>W</kbd><br /><kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd></div></div>
    </aside>
  );
});
