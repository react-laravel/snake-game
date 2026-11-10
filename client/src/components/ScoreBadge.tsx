import { useEffect, useRef, useState } from 'react';

export function ScoreBadge({ score, personalBest, rankLabel, lengthLabel }: { score: number; personalBest: number; rankLabel: string; lengthLabel: string }) {
  const previousRef = useRef(score);
  const [bump, setBump] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (score > previousRef.current) {
      setBump(true);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        setBump(false);
      }, 320);
    }
    previousRef.current = score;
  }, [score]);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  const chasing = personalBest > 0 && score < personalBest && score >= personalBest - 20;
  const record = personalBest > 0 && score >= personalBest;

  return (
    <div className={`score-badge${bump ? ' score-badge-bump' : ''}`} aria-live="polite" aria-atomic="true">
      <span>你的积分{rankLabel ? ` · ${rankLabel}` : ''}{lengthLabel ? ` · ${lengthLabel}` : ''}{record ? ' · 新高' : chasing ? ` · 距最高 ${personalBest - score}` : ''}</span>
      <strong>{score}</strong>
    </div>
  );
}
