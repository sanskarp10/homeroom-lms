import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { BookOpen, Award, Download } from 'lucide-react';
import { useGetEnrollmentsQuery, useGetMyLiveQuery } from '../store/api.js';
import { selectUser } from '../store/authSlice.js';
import CourseCover from '../components/CourseCover.jsx';
import Timetable, { TimetableSkeleton } from '../components/Timetable.jsx';
import { Empty, ProgressBar, Skeleton } from '../components/ui.jsx';
import { plural, dateLabel, assetUrl } from '../lib/format.js';

function EnrollmentRow({ item }) {
  const { course } = item;
  const done = item.progress === 100;
  return (
    <li className="panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5">
      <Link to={`/learn/${course.id}${item.lastLesson ? `/${item.lastLesson}` : ''}`} className="block w-full shrink-0 rounded-cover sm:w-44" tabIndex={-1} aria-hidden="true">
        <CourseCover course={course} as="p" />
      </Link>
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-xl font-semibold leading-snug"><Link to={`/courses/${course.slug}`} className="hover:underline hover:decoration-pencil hover:decoration-2 hover:underline-offset-4">{course.title}</Link></h3>
        <p className="mt-0.5 text-sm text-ink-faint">{course.instructor?.name}</p>
        <div className="mt-3 flex items-center gap-3">
          <ProgressBar value={item.progress} tone={done ? 'pass' : 'pencil'} className="max-w-xs" />
          <span className="shrink-0 text-xs tabular text-ink-faint">{item.completedCount} of {plural(course.lessonCount, 'lesson')}</span>
        </div>
        {done && item.completedAt && <p className="mt-2 text-xs text-pass">Completed {dateLabel(item.completedAt)}</p>}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">
        <Link to={`/learn/${course.id}${item.lastLesson ? `/${item.lastLesson}` : ''}`} className={done ? 'btn-outline' : 'btn-accent'}>{done ? 'Review' : item.progress > 0 ? 'Continue' : 'Start'}</Link>
        {item.certificate && <a href={assetUrl(item.certificate.pdfUrl)} target="_blank" rel="noreferrer" className="btn-outline"><Download className="h-4 w-4" />Certificate</a>}
      </div>
    </li>
  );
}

export default function MyLearning() {
  const user = useSelector(selectUser);
  const { data, isLoading } = useGetEnrollmentsQuery();
  const live = useGetMyLiveQuery(undefined, { pollingInterval: 60000 });
  const items = data?.items || [];
  const active = items.filter((i) => i.progress < 100);
  const finished = items.filter((i) => i.progress === 100);

  return (
    <div className="page pt-10">
      <h1 className="text-4xl font-semibold sm:text-5xl">My learning</h1>
      <p className="mt-2 text-ink-soft">Welcome back, {user.name.split(' ')[0]}.{items.length > 0 && ` ${plural(active.length, 'course')} in progress, ${finished.length} finished.`}</p>

      <div className="mt-9 grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-10">
          <section>
            <h2 className="mb-4 text-2xl font-semibold">In progress</h2>
            {isLoading ? <div className="space-y-4"><Skeleton className="h-36 rounded-panel" /><Skeleton className="h-36 rounded-panel" /></div>
              : active.length ? <ul className="space-y-4">{active.map((i) => <EnrollmentRow key={i.id} item={i} />)}</ul>
              : <Empty icon={BookOpen} title={items.length ? 'Everything is finished' : 'You are not enrolled in a course yet'} action={<Link to="/courses" className="btn-primary">Browse courses</Link>}>
                  {items.length ? 'Pick your next course from the catalog.' : 'Several courses are free, so you can try one without paying.'}
                </Empty>}
          </section>
          {finished.length > 0 && (
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-2xl font-semibold"><Award className="h-5 w-5 text-pencil-dark" aria-hidden="true" />Finished</h2>
              <ul className="space-y-4">{finished.map((i) => <EnrollmentRow key={i.id} item={i} />)}</ul>
            </section>
          )}
        </div>

        <aside>
          <div className="board overflow-hidden rounded-panel lg:sticky lg:top-24">
            <h2 className="border-b border-white/10 px-5 pb-3.5 pt-5 text-xl font-medium text-white sm:px-7">Your live classes</h2>
            {live.isLoading ? <TimetableSkeleton rows={3} /> : <Timetable items={live.data?.upcoming || []} compact emptyText="No live classes are scheduled for your courses yet." />}
          </div>
        </aside>
      </div>
    </div>
  );
}
