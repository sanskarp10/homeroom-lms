import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { Check, ChevronDown, CirclePlay, FileText, ListChecks, Clock, BookOpen, Users, Signal, Award, Radio, Infinity as InfinityIcon, Pencil, Lock } from 'lucide-react';
import { useGetCourseQuery, useGetLessonQuery } from '../store/api.js';
import { useEnroll } from '../hooks/useEnroll.js';
import CourseCover from '../components/CourseCover.jsx';
import VideoPlayer from '../components/VideoPlayer.jsx';
import { Avatar, Empty, Modal, PageLoader, ProgressBar, Skeleton, Spinner, StatusTag } from '../components/ui.jsx';
import { money, duration, plural, titleCase, dayLabel, timeLabel, errorMessage } from '../lib/format.js';

export const LESSON_ICONS = { video: CirclePlay, article: FileText, quiz: ListChecks };
const LESSON_LABEL = { video: 'Video', article: 'Reading', quiz: 'Quiz' };

function PreviewModal({ lessonId, onClose }) {
  const { data, isLoading, error } = useGetLessonQuery(lessonId, { skip: !lessonId });
  return (
    <Modal open={!!lessonId} onClose={onClose} title={data?.lesson.title || 'Preview'} width="max-w-3xl">
      {isLoading && <Skeleton className="aspect-video w-full" />}
      {error && <p className="text-sm text-redpen">{errorMessage(error)}</p>}
      {data?.lesson.video?.url && <VideoPlayer src={data.lesson.video.url} poster={data.lesson.video.posterUrl} autoPlay className="rounded-lg" title={data.lesson.title} />}
      {data && !data.lesson.video?.url && <p className="text-sm text-ink-faint">This preview has no video yet.</p>}
    </Modal>
  );
}

function Curriculum({ curriculum, onPreview }) {
  const [open, setOpen] = useState(() => new Set(curriculum.slice(0, 1).map((s) => s.id)));
  const toggle = (id) => setOpen((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  return (
    <div className="overflow-hidden rounded-panel border border-line bg-white">
      {curriculum.map((section, index) => {
        const isOpen = open.has(section.id);
        const total = section.lessons.reduce((sum, l) => sum + l.duration, 0);
        return (
          <section key={section.id} className={clsx(index > 0 && 'border-t border-line')}>
            <h3 className="font-sans">
              <button type="button" onClick={() => toggle(section.id)} aria-expanded={isOpen} className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-paper/70">
                <ChevronDown className={clsx('h-4 w-4 shrink-0 text-ink-faint transition-transform duration-150', !isOpen && '-rotate-90')} aria-hidden="true" />
                <span className="flex-1 text-[15px] font-semibold">{section.title}</span>
                <span className="shrink-0 text-xs tabular text-ink-faint">{plural(section.lessons.length, 'lesson')}{total > 0 && `, ${duration(total)}`}</span>
              </button>
            </h3>
            {isOpen && (
              <ul className="border-t border-line bg-paper/40 py-1">
                {section.lessons.map((lesson) => {
                  const Icon = LESSON_ICONS[lesson.type];
                  return (
                    <li key={lesson.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                      <Icon className="h-4 w-4 shrink-0 text-board-500" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-ink-soft">{lesson.title}<span className="sr-only">, {LESSON_LABEL[lesson.type]}</span></span>
                      {lesson.isPreview && lesson.type === 'video' && (
                        <button type="button" onClick={() => onPreview(lesson.id)} className="link shrink-0 text-xs">Preview</button>
                      )}
                      <span className="w-14 shrink-0 text-right text-xs tabular text-ink-faint">{duration(lesson.duration)}</span>
                    </li>
                  );
                })}
                {section.lessons.length === 0 && <li className="px-5 py-2.5 text-sm text-ink-faint">Lessons are on their way.</li>}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function EnrollCard({ course, access, firstLessonCount }) {
  const { enroll, busy } = useEnroll(course);
  const includes = [
    [BookOpen, plural(firstLessonCount, 'lesson')],
    course.totalDuration > 0 && [Clock, `${duration(course.totalDuration)} of material`],
    [Radio, 'Live classes with the instructor'],
    [Award, 'Certificate when you finish'],
    [InfinityIcon, 'Yours to keep'],
  ].filter(Boolean);

  return (
    <aside className="lg:sticky lg:top-24">
      <CourseCover course={course} as="p" />
      <div className="panel mt-5 p-5">
        {access.manage ? (
          <>
            <p className="text-sm text-ink-soft">You teach this course.</p>
            <Link to={`/teach/courses/${course.id}`} className="btn-primary mt-4 w-full"><Pencil className="h-4 w-4" />Edit course</Link>
            <Link to={`/learn/${course.id}`} className="btn-outline mt-2 w-full">View as a student</Link>
          </>
        ) : access.enrolled ? (
          <>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold">{access.progress === 100 ? 'Course complete' : access.progress > 0 ? 'In progress' : 'Enrolled'}</span>
              <span className="tabular text-ink-faint">{access.progress}%</span>
            </div>
            <ProgressBar value={access.progress} className="mt-2" />
            <Link to={`/learn/${course.id}${access.lastLesson ? `/${access.lastLesson}` : ''}`} className="btn-accent btn-lg mt-5 w-full">
              {access.progress === 100 ? 'Review the course' : access.progress > 0 ? 'Continue learning' : 'Start the first lesson'}
            </Link>
          </>
        ) : (
          <>
            <p className="font-display text-4xl font-semibold tabular">{money(course.price)}</p>
            <button type="button" onClick={enroll} disabled={busy} className="btn-accent btn-lg mt-4 w-full">
              {busy && <Spinner />}{course.price === 0 ? 'Enroll for free' : 'Buy this course'}
            </button>
            {course.price > 0 && <p className="mt-2.5 text-center text-xs text-ink-faint">One payment. No subscription.</p>}
          </>
        )}
        <ul className="mt-5 space-y-2.5 border-t border-line pt-5 text-sm text-ink-soft">
          {includes.map(([Icon, text]) => <li key={text} className="flex items-center gap-2.5"><Icon className="h-4 w-4 shrink-0 text-board-500" aria-hidden="true" />{text}</li>)}
        </ul>
      </div>
    </aside>
  );
}

export default function CourseDetail() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const { data, isLoading, error } = useGetCourseQuery(slug);
  const [preview, setPreview] = useState(null);

  if (isLoading) return <PageLoader label="Loading course" />;
  if (error) {
    return (
      <div className="page pt-16">
        <Empty icon={Lock} title={error.status === 404 ? 'This course does not exist' : 'This course could not be loaded'} action={<Link to="/courses" className="btn-primary">Browse courses</Link>}>
          {error.status === 404 ? 'It may have been unpublished, or the link is wrong.' : errorMessage(error)}
        </Empty>
      </div>
    );
  }
  const { course, curriculum, liveClasses, access, instructorCourseCount } = data;
  const lessonCount = curriculum.reduce((sum, s) => sum + s.lessons.length, 0);

  return (
    <div className="page pt-8 lg:pt-12">
      {params.get('checkout') === 'cancelled' && <p className="mb-6 rounded-lg border border-pencil/40 bg-pencil-light px-4 py-3 text-sm text-pencil-deep">Checkout was cancelled. You have not been charged.</p>}
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
        <div className="min-w-0">
          <nav className="flex flex-wrap items-center gap-2 text-sm text-ink-faint" aria-label="Breadcrumb">
            <Link to="/courses" className="hover:text-ink">Courses</Link><span aria-hidden="true">/</span>
            <Link to={`/courses?category=${encodeURIComponent(course.category)}`} className="hover:text-ink">{course.category}</Link>
            {course.status !== 'published' && <StatusTag status={course.status} className="ml-1" />}
          </nav>
          <h1 className="mt-4 text-balance text-4xl font-semibold leading-[1.08] sm:text-5xl">{course.title}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft">{course.subtitle}</p>
          <ul className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-soft">
            <li className="flex items-center gap-2"><Avatar name={course.instructor.name} size={26} /><span>Taught by <span className="font-semibold text-ink">{course.instructor.name}</span></span></li>
            <li className="flex items-center gap-1.5"><Signal className="h-4 w-4 text-board-500" aria-hidden="true" />{titleCase(course.level)}</li>
            <li className="flex items-center gap-1.5"><Users className="h-4 w-4 text-board-500" aria-hidden="true" />{plural(course.enrollmentCount, 'student')}</li>
          </ul>

          {course.outcomes.length > 0 && (
            <section className="mt-10">
              <h2 className="text-2xl font-semibold">What you will be able to do</h2>
              <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                {course.outcomes.map((o) => (
                  <li key={o} className="flex gap-2.5 text-[15px] leading-snug text-ink-soft"><Check className="mt-0.5 h-4 w-4 shrink-0 text-pencil-dark" strokeWidth={3} aria-hidden="true" />{o}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-10">
            <h2 className="text-2xl font-semibold">About this course</h2>
            <div className="mt-3 max-w-[68ch] space-y-4 text-[1.0625rem] leading-[1.7] text-ink-soft">
              {course.description.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
            </div>
          </section>

          <section className="mt-10">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 className="text-2xl font-semibold">Course content</h2>
              <p className="text-sm tabular text-ink-faint">{plural(curriculum.length, 'section')}, {plural(lessonCount, 'lesson')}</p>
            </div>
            <Curriculum curriculum={curriculum} onPreview={setPreview} />
          </section>

          {liveClasses.length > 0 && (
            <section className="mt-10">
              <h2 className="text-2xl font-semibold">Upcoming live classes</h2>
              <ul className="mt-4 divide-y divide-line overflow-hidden rounded-panel border border-line bg-white">
                {liveClasses.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4">
                    <div className="w-32 shrink-0">
                      <p className="text-sm font-semibold">{c.status === 'live' ? 'Happening now' : dayLabel(c.scheduledAt)}</p>
                      <p className="text-sm tabular text-ink-faint">{timeLabel(c.scheduledAt)}, {c.durationMin} min</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{c.title}</p>
                      {c.description && <p className="mt-0.5 text-sm text-ink-faint">{c.description}</p>}
                    </div>
                    {c.status === 'live' && <StatusTag status="live">Live</StatusTag>}
                    {(access.enrolled || access.manage) && <Link to={`/live/${c.id}`} className={c.status === 'live' ? 'btn-accent btn-sm' : 'btn-outline btn-sm'}>{c.status === 'live' ? 'Join now' : 'Open classroom'}</Link>}
                  </li>
                ))}
              </ul>
              {!access.enrolled && !access.manage && <p className="mt-2.5 text-sm text-ink-faint">Live classes are open to enrolled students.</p>}
            </section>
          )}

          <section className="mt-10">
            <h2 className="text-2xl font-semibold">Your instructor</h2>
            <div className="mt-4 flex gap-4">
              <Avatar name={course.instructor.name} size={56} />
              <div>
                <p className="font-display text-xl font-semibold">{course.instructor.name}</p>
                <p className="text-sm text-ink-faint">{course.instructor.headline}{course.instructor.headline && ' '}({plural(instructorCourseCount, 'course')} on Homeroom)</p>
                {course.instructor.bio && <p className="mt-3 max-w-[64ch] leading-relaxed text-ink-soft">{course.instructor.bio}</p>}
              </div>
            </div>
          </section>
        </div>

        <EnrollCard course={course} access={access} firstLessonCount={lessonCount} />
      </div>
      <PreviewModal lessonId={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
