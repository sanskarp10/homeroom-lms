import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ArrowRight } from 'lucide-react';
import { useGetCoursesQuery, useGetCategoriesQuery, useGetScheduleQuery, useGetPaymentConfigQuery } from '../store/api.js';
import { selectUser } from '../store/authSlice.js';
import CourseCard, { CourseCardSkeleton } from '../components/CourseCard.jsx';
import Timetable, { TimetableSkeleton } from '../components/Timetable.jsx';
import { subjectColor } from '../components/CourseCover.jsx';

const STEPS = [
  ['Enroll in a course', 'Free courses start straight away. Paid ones unlock the moment checkout finishes.'],
  ['Watch and read at your pace', 'Video lessons stream in the quality your connection can carry and resume where you stopped.'],
  ['Come to class', 'Each course has scheduled live sessions with video, screen sharing and chat.'],
  ['Pass the quizzes, keep the certificate', 'Quizzes are marked instantly. Finish every lesson and a PDF certificate is issued with an ID anyone can verify.'],
];

export default function Home() {
  const user = useSelector(selectUser);
  const popular = useGetCoursesQuery({ sort: 'popular', limit: 8 });
  const categories = useGetCategoriesQuery();
  const schedule = useGetScheduleQuery(6, { pollingInterval: 60000 });
  const payments = useGetPaymentConfigQuery();
  const keep = 100 - (payments.data?.platformFeePercent ?? 20);

  return (
    <>
      <section className="page grid items-start gap-10 pb-16 pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-14 lg:pb-24 lg:pt-16">
        <div className="lg:pt-6">
          <h1 className="text-balance text-[2.6rem] font-semibold leading-[1.04] sm:text-6xl lg:text-[4.25rem]">
            Watch the lesson. Then come to class.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
            Homeroom is an online school. Courses are recorded so you can learn when it suits you, and every course
            meets live so you can ask the person who made it.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/courses" className="btn-accent btn-lg">Browse courses</Link>
            {user ? (
              <Link to={user.role === 'student' ? '/learning' : '/teach'} className="btn-outline btn-lg">{user.role === 'student' ? 'Continue learning' : 'Open your courses'}</Link>
            ) : (
              <Link to="/register" className="btn-outline btn-lg">Create a free account</Link>
            )}
          </div>
        </div>

        <div className="board overflow-hidden rounded-panel shadow-pop">
          <div className="flex items-baseline justify-between gap-4 border-b border-white/10 px-5 pb-3.5 pt-5 sm:px-7">
            <h2 className="text-xl font-medium text-white">Live class timetable</h2>
            <Link to="/live" className="on-board rounded text-[13px] font-semibold text-pencil hover:underline">Full schedule</Link>
          </div>
          {schedule.isLoading ? <TimetableSkeleton /> : <Timetable items={schedule.data?.items || []} animate compact />}
        </div>
      </section>

      <section className="page">
        <div className="mb-7 flex items-end justify-between gap-4">
          <h2 className="text-3xl font-semibold">Most enrolled</h2>
          <Link to="/courses" className="link inline-flex items-center gap-1 text-sm">All courses <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
        <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {popular.isLoading
            ? Array.from({ length: 8 }, (_, i) => <CourseCardSkeleton key={i} />)
            : popular.data?.items.map((c) => <CourseCard key={c.id} course={c} />)}
        </div>
        {popular.isError && <p className="mt-6 text-sm text-redpen">The course list could not be loaded. Check that the API is running on port 4000.</p>}
      </section>

      <section className="page mt-20">
        <h2 className="text-3xl font-semibold">Subjects</h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(categories.data?.categories || []).map((c) => (
            <li key={c.name}>
              <Link to={`/courses?category=${encodeURIComponent(c.name)}`} className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3.5 transition-colors duration-100 hover:border-board">
                <span className="h-9 w-2 rounded-sm" style={{ backgroundColor: subjectColor(c.name) }} aria-hidden="true" />
                <span className="flex-1 font-semibold">{c.name}</span>
                <span className="text-sm tabular text-ink-faint">{c.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="page mt-20 grid gap-10 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <div>
          <h2 className="text-3xl font-semibold">How a course runs</h2>
          <p className="mt-3 text-ink-soft">The same four steps, whatever you study.</p>
        </div>
        <ol className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="flex gap-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-board font-display text-base font-semibold text-white" aria-hidden="true">{i + 1}</span>
              <div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {(!user || user.role === 'student') && (
        <section className="page mt-20">
          <div className="board flex flex-col gap-6 rounded-panel px-6 py-9 sm:px-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-medium text-white">Teach a course of your own</h2>
              <p className="mt-3 leading-relaxed text-white/75">
                Upload your videos and Homeroom converts them for streaming. Add quizzes, schedule live classes and
                watch your earnings as they come in. You keep {keep}% of every sale.
              </p>
            </div>
            <Link to="/register?role=instructor" className="on-board btn-accent btn-lg shrink-0">Start teaching</Link>
          </div>
        </section>
      )}
    </>
  );
}
