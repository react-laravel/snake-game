import type { DeathEvent } from '../types/game';

interface DeathFeedProps {
  deaths: DeathEvent[];
}

export function DeathFeed({ deaths }: DeathFeedProps) {
  return (
    <>
      {deaths.map((event, index) => (
        <div key={`${event.victim}-${index}`} className="death-toast">
          {event.killer ? (
            <span>
              X <b>{event.victimName}</b> 被 <b>{event.killerName}</b> 击杀！
              <span className="death-bonus">+100</span>
            </span>
          ) : (
            <span>
              X <b>{event.victimName}</b> 撞墙了
            </span>
          )}
        </div>
      ))}
    </>
  );
}
