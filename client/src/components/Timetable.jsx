/**
 * The live class timetable, drawn on a chalkboard. Rows are grouped by day,
 * the way a school timetable hangs in a corridor.
 */
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Radio } from 'lucide-react';
import { dayLabel, timeLabel, fromNow } from '../lib/format.js';
import { subjectColor } from './CourseCover.jsx';

function groupByDay(items) {
  const groups = [];
  for (const item of items) {
    const label = item.status === 'live' ? 'Now' : dayLabel(item.scheduledAt);
    const last = groups.at(-1);
    if (last?.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

export function TimetableSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-5 px-5 py-5 sm:px-7" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-4">
          <div className="h-4 w-14 rounded bg-white/10" />
          <div className="flex-1 space-y-2"><div className="h-4 w-3/4 rounded bg-white/10" /><div className="h-3 w-1/2 rounded bg-white/[.06]" /></div>
        </div>
      ))}
    </div>
  );
}

export default function Timetable({ items, animate = false, compact = false, emptyText = 'No live classes are scheduled yet.' }) {
  if (!items.length) return <p className="px-5 py-10 text-center text-sm text-white/60 sm:px-7">{emptyText}</p>;
  let row = 0;
  return (
    <div className="on-board">
      {groupByDay(items).map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h3 className={clsx('border-b border-white/10 px-5 pb-2 pt-4 font-sans text-xs font-semibold sm:px-7', group.label === 'Now' ? 'text-pencil' : 'text-white/50')}>{group.label}</h3>
          <ul>
            {group.items.map((item) => {
              const live = item.status === 'live';
              const to = item.canJoin ? `/live/${item.id}` : `/courses/${item.course.slug}`;
              const delay = animate ? { animationDelay: `${120 + row++ * 70}ms` } : undefined;
              return (
                <li key={item.id} className={clsx('border-b border-white/[.07] last:border-0', animate && 'animate-chalk')} style={delay}>
                  <Link to={to} className="group flex items-start gap-4 px-5 py-3.5 transition-colors duration-100 hover:bg-white/[.05] sm:px-7">
                    <div className="w-[4.5rem] shrink-0 pt-0.5">
                      {live ? (
                        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-pencil"><Radio className="h-4 w-4 animate-pulse-dot" aria-hidden="true" />Live</span>
                      ) : (
                        <span className="text-sm font-semibold tabular text-white">{timeLabel(item.scheduledAt)}</span>
                      )}
                      {!compact && <span className="mt-0.5 block text-xs text-white/45">{item.durationMin} min</span>}
                    </div>
                    <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/25" style={{ backgroundColor: subjectColor(item.course.category) }} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 font-display text-[1.02rem] font-medium leading-snug text-white group-hover:underline group-hover:decoration-pencil group-hover:decoration-2 group-hover:underline-offset-4">{item.title}</p>
                      <p className="mt-0.5 truncate text-[13px] text-white/60">{item.course.title}, with {item.instructor?.name}</p>
                    </div>
                    <span className={clsx('shrink-0 self-center rounded-full px-2.5 py-1 text-xs font-semibold', compact && !live && !item.canJoin ? 'hidden' : 'hidden sm:inline-block', live ? 'bg-pencil text-ink' : item.canJoin ? 'bg-white/10 text-white' : 'text-white/45')}>
                      {live ? (item.canJoin ? 'Join now' : 'In progress') : item.canJoin ? fromNow(item.scheduledAt) : 'Enroll to join'}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
