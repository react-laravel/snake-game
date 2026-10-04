export function ScoreBadge({ score }: { score: number }) {
  return <div className="score-badge"><span>你的积分</span><strong>{score}</strong></div>;
}
