import type { DeathEvent } from '../types/game';
import { deathCopy } from '../game/deathCopy';

export function DeathFeed({ deaths }: { deaths: DeathEvent[] }) {
  return (
    <div className="death-feed" aria-live="polite" aria-atomic="false">
      {deaths.map((event) => {
        const copy = deathCopy(event);
        return (
          <div key={event.id} className="death-toast">
            <span aria-hidden="true">× </span><b>{event.victimName}</b>
            {copy.kind === 'kill' && <> 被 <b>{copy.name}</b> 击杀</>}
            {copy.kind === 'head-on' && ' 正面相撞'}
            {copy.kind === 'crash' && <> 撞上 <b>{copy.name}</b></>}
            {copy.kind === 'collision' && ' 碰撞出局'}
          </div>
        );
      })}
    </div>
  );
}
