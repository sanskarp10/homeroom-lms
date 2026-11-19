import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetScheduleQuery, useGetMyLiveQuery } from '../store/api.js';
import { selectUser } from '../store/authSlice.js';
import Timetable, { TimetableSkeleton } from '../components/Timetable.jsx';
import { dateLabel, timeLabel } from '../lib/format.js';

export default function LiveSchedule() {
  const user = useSelector(selectUser);
  const schedule = useGetScheduleQuery(30, { pollingInterval: 30000 });
  const mine = useGetMyLiveQuery(undefined, { skip: !user, pollingInterval: 30000 });
  const past = mine.data?.past || [];

  return (
    <div className="page pt-10">
      <div className="max-w-2xl">
        <h1 className="text-4xl font-semibold sm:text-5xl">Live classes</h1>
        <p className="mt-2 text-ink-soft">
          Every course meets live. Classes run in your browser with video, screen sharing and chat.
          {!user && <> <Link to="/login" className="link">Sign in</Link> to join the classes of courses you are enrolled in.</>}
        </p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="board overflow-hidden rounded-panel">
          <h2 className="border-b border-white/10 px-5 pb-3.5 pt-5 text-xl font-medium text-white sm:px-7">Timetable</h2>
          {schedule.isLoading ? <TimetableSkeleton rows={6} /> : <Timetable items={schedule.data?.items || []} />}
        </div>

        <aside className="space-y-6">
          {user && (
            <section className="panel p-5">
              <h2 className="text-lg font-semibold">Your classes</h2>
              {(mine.data?.upcoming || []).length === 0 ? (
                <p className="mt-2 text-sm text-ink-faint">{user.role === 'student' ? 'Enroll in a course to see its classes here.' : 'Schedule a class from the Live classes tab of a course you teach.'}</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {mine.data.upcoming.slice(0, 6).map((c) => (
                    <li key={c.id}>
                      <Link to={`/live/${c.id}`} className="block rounded-lg border border-line px-3.5 py-3 transition-colors duration-100 hover:border-board">
                        <p className="text-sm font-semibold">{c.title}</p>
                        <p className="mt-0.5 text-xs text-ink-faint">{c.status === 'live' ? 'Live now' : `${dateLabel(c.scheduledAt)}, ${timeLabel(c.scheduledAt)}`}{c.isHost && ' (you are the host)'}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {past.length > 0 && (
            <section className="panel p-5">
              <h2 className="text-lg font-semibold">Recently ended</h2>
              <ul className="mt-3 space-y-2.5 text-sm">
                {past.map((c) => (
                  <li key={c.id} className="flex items-baseline justify-between gap-3">
                    <Link to={`/live/${c.id}`} className="min-w-0 truncate text-ink-soft hover:text-ink hover:underline">{c.title}</Link>
                    <span className="shrink-0 text-xs text-ink-faint">{dateLabel(c.endedAt || c.scheduledAt)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
