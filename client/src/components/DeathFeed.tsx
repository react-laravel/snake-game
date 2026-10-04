import type { DeathEvent } from '../types/game';

export function DeathFeed({ deaths }: { deaths: DeathEvent[] }) {
  return (
    <div className="death-feed" aria-live="polite" aria-atomic="false">
      {deaths.map((event) => <div key={event.id} className="death-toast"><span aria-hidden="true">× </span><b>{event.victimName}</b>{event.killerName ? <> 被 <b>{event.killerName}</b> 击杀</> : ' 碰撞出局'}</div>)}
    </div>
  );
}
