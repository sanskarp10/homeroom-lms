import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import clsx from 'clsx';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, PanelRightClose, PanelRightOpen, Award, Download, Hourglass, CircleCheck, Circle } from 'lucide-react';
import { api, useGetLearnCourseQuery, useGetLessonQuery, useSavePositionMutation, useCompleteLessonMutation } from '../store/api.js';
import { toast } from '../store/uiSlice.js';
import VideoPlayer from '../components/VideoPlayer.jsx';
import Quiz from '../components/Quiz.jsx';
import { Markdown } from '../lib/markdown.jsx';
import { Empty, Modal, PageLoader, ProgressBar, Skeleton, Spinner } from '../components/ui.jsx';
import { Logo } from '../components/Layout.jsx';
import { LESSON_ICONS } from './CourseDetail.jsx';
import { duration, errorMessage, assetUrl } from '../lib/format.js';

function Sidebar({ curriculum, courseId, currentId, onNavigate }) {
  const activeRef = useRef(null);
  useEffect(() => { activeRef.current?.scrollIntoView({ block: 'nearest' }); }, [currentId]);
  return (
    <nav aria-label="Course content" className="scroll-thin h-full overflow-y-auto">
      {curriculum.map((section, si) => {
        const done = section.lessons.filter((l) => l.completed).length;
        return (
          <section key={section.id}>
            <h3 className="sticky top-0 z-10 flex items-baseline justify-between gap-3 border-b border-line bg-paper px-4 py-3 font-sans">
              <span className="text-[13px] font-semibold"><span className="text-ink-faint">Section {si + 1}.</span> {section.title}</span>
              <span className="shrink-0 text-xs tabular text-ink-faint">{done}/{section.lessons.length}</span>
            </h3>
            <ul>
              {section.lessons.map((lesson) => {
                const Icon = LESSON_ICONS[lesson.type];
                const active = lesson.id === currentId;
                return (
                  <li key={lesson.id}>
                    <Link ref={active ? activeRef : undefined} to={`/learn/${courseId}/${lesson.id}`} onClick={onNavigate} aria-current={active ? 'page' : undefined}
                      className={clsx('flex items-start gap-3 border-l-[3px] px-4 py-3 text-sm transition-colors duration-100', active ? 'border-pencil bg-white' : 'border-transparent hover:bg-white/70')}>
                      {lesson.completed
                        ? <CircleCheck className="mt-0.5 h-[18px] w-[18px] shrink-0 text-pass" aria-label="Completed" />
                        : <Circle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-line-strong" aria-label="Not completed" />}
                      <span className="min-w-0 flex-1">
                        <span className={clsx('block leading-snug', active ? 'font-semibold text-ink' : 'text-ink-soft')}>{lesson.title}</span>
                        <span className="mt-1 flex items-center gap-1.5 text-xs text-ink-faint"><Icon className="h-3.5 w-3.5" aria-hidden="true" />{duration(lesson.duration)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </nav>
  );
}

function LessonBody({ courseId, lessonId, enrolled, onProgress, goNext, hasNext }) {
  const dispatch = useDispatch();
  const { data, isLoading, error } = useGetLessonQuery(lessonId);
  const [savePosition] = useSavePositionMutation();
  const [complete, completeState] = useCompleteLessonMutation();
  const [done, setDone] = useState(false);
  const doneRef = useRef(false);
  useEffect(() => { const v = !!data?.completed; setDone(v); doneRef.current = v; }, [data?.completed, lessonId]);

  const onTime = useCallback(async (position) => {
    if (!enrolled) return;
    try {
      const result = await savePosition({ lessonId, position }).unwrap();
      if (result.completed && !doneRef.current) {
        doneRef.current = true;
        setDone(true);
        dispatch(api.util.invalidateTags([{ type: 'Learn', id: courseId }, 'Enrollments', 'Certificates']));
        onProgress(result);
      }
    } catch { /* position saving is best-effort */ }
  }, [enrolled, lessonId, courseId, savePosition, dispatch, onProgress]);

  // Optimistic: the tick appears immediately and is rolled back if the server refuses.
  const toggle = async (value) => {
    const before = doneRef.current;
    setDone(value);
    doneRef.current = value;
    try {
      onProgress(await complete({ lessonId, courseId, completed: value }).unwrap());
      return true;
    } catch (err) {
      setDone(before);
      doneRef.current = before;
      dispatch(toast.error(errorMessage(err)));
      return false;
    }
  };
  const completeAndContinue = async () => { if (done || (await toggle(true))) goNext(); };

  if (isLoading) return <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8"><Skeleton className="aspect-video w-full rounded-lg" /><Skeleton className="mt-6 h-8 w-2/3" /><Skeleton className="mt-3 h-4 w-full" /></div>;
  if (error) return <div className="mx-auto max-w-2xl px-4 py-14"><Empty title="This lesson could not be opened">{errorMessage(error)}</Empty></div>;
  const { lesson } = data;

  const footer = (
    <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
      {lesson.type !== 'quiz' && enrolled ? (
        <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
          <input type="checkbox" checked={done} disabled={completeState.isLoading} onChange={(e) => toggle(e.target.checked)} className="h-4 w-4 accent-[#1F3A33]" />
          {done ? 'Completed' : 'Mark as complete'}
        </label>
      ) : <span className="text-sm text-ink-faint">{lesson.type === 'quiz' ? (done ? 'Quiz passed.' : 'Pass this quiz to complete the lesson.') : 'Preview mode: progress is not tracked.'}</span>}
      {hasNext && (lesson.type === 'article' && enrolled && !done
        ? <button type="button" onClick={completeAndContinue} className="btn-primary" disabled={completeState.isLoading}>{completeState.isLoading && <Spinner />}Complete and continue<ChevronRight className="h-4 w-4" /></button>
        : <button type="button" onClick={goNext} className={done ? 'btn-primary' : 'btn-outline'}>Next lesson<ChevronRight className="h-4 w-4" /></button>)}
    </div>
  );

  if (lesson.type === 'video') {
    const ready = lesson.video.status === 'ready' && lesson.video.url;
    return (
      <>
        <div className="bg-black">
          <div className="mx-auto w-full max-w-5xl">
            {ready
              ? <VideoPlayer key={lesson.id} src={lesson.video.url} poster={lesson.video.posterUrl} startAt={done ? 0 : data.position} onTime={onTime} title={lesson.title} />
              : <div className="grid aspect-video place-items-center px-6 text-center text-sm text-white/70"><div><Hourglass className="mx-auto mb-2 h-6 w-6 text-pencil" aria-hidden="true" />{lesson.video.status === 'none' ? 'The instructor has not added a video to this lesson yet.' : 'This video is still being prepared for streaming. Check back in a few minutes.'}</div></div>}
          </div>
        </div>
        <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8">
          <h1 className="text-3xl font-semibold leading-tight">{lesson.title}</h1>
          {lesson.content && <Markdown source={lesson.content} className="prose-lesson mt-4" />}
          {footer}
        </div>
      </>
    );
  }
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-9 sm:px-8 sm:py-12">
      <p className="text-sm text-ink-faint">{lesson.type === 'quiz' ? 'Quiz' : `Reading, ${duration(lesson.duration)}`}</p>
      <h1 className="mb-7 mt-1 text-4xl font-semibold leading-tight">{lesson.title}</h1>
      {lesson.type === 'article'
        ? <Markdown source={lesson.content || 'This lesson has no text yet.'} />
        : <Quiz key={lesson.id} lesson={lesson} courseId={courseId} lastAttempt={data.lastAttempt} attempts={data.attempts} onGraded={(r) => { if (r.attempt.passed) { setDone(true); doneRef.current = true; } if (r.progress !== undefined) onProgress(r); }} />}
      {footer}
    </div>
  );
}

export default function Player() {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { data, isLoading, error } = useGetLearnCourseQuery(courseId);
  const [panel, setPanel] = useState(() => window.innerWidth >= 1024);
  const [celebrate, setCelebrate] = useState(null);

  const lessons = useMemo(() => (data?.curriculum || []).flatMap((s) => s.lessons), [data]);
  const index = lessons.findIndex((l) => l.id === lessonId);
  const next = index >= 0 ? lessons[index + 1] : null;
  const previous = index > 0 ? lessons[index - 1] : null;

  const onProgress = useCallback((result) => {
    if (result.courseCompleted && result.certificate) setCelebrate(result.certificate);
    else if (result.completed) dispatch(toast.success('Lesson complete.'));
  }, [dispatch]);
  const goNext = useCallback(() => { if (next) navigate(`/learn/${courseId}/${next.id}`); }, [next, navigate, courseId]);

  if (isLoading) return <PageLoader label="Opening course" />;
  if (error) {
    return (
      <div className="page pt-20">
        <Empty title={error.status === 403 ? 'You are not enrolled in this course' : 'This course could not be opened'} action={<Link to="/courses" className="btn-primary">Browse courses</Link>}>{errorMessage(error)}</Empty>
      </div>
    );
  }
  const { course, curriculum, enrollment, certificate } = data;
  if (!lessons.length) return <div className="page pt-20"><Empty title="This course has no lessons yet" action={<Link to={`/courses/${course.slug}`} className="btn-primary">Back to the course</Link>}>The instructor is still building it.</Empty></div>;
  if (!lessonId || index === -1) {
    const resume = lessons.find((l) => l.id === enrollment?.lastLesson) || lessons.find((l) => !l.completed) || lessons[0];
    return <Navigate to={`/learn/${courseId}/${resume.id}`} replace />;
  }
  const progress = enrollment?.progress ?? 0;
  const closeOnMobile = () => { if (window.innerWidth < 1024) setPanel(false); };

  return (
    <div className="flex h-screen flex-col bg-paper">
      <header className="on-board flex h-14 shrink-0 items-center gap-3 bg-board px-3 text-white sm:px-4">
        <Link to={`/courses/${course.slug}`} className="btn-icon btn rounded-md text-white/80 hover:bg-white/10 hover:text-white" aria-label="Back to course page"><ArrowLeft className="h-5 w-5" /></Link>
        <Logo light className="hidden sm:inline-flex" />
        <span className="hidden h-5 w-px bg-white/20 sm:block" aria-hidden="true" />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{course.title}</p>
        {enrollment && (
          <div className="hidden w-44 items-center gap-2.5 md:flex">
            <ProgressBar value={progress} className="bg-white/15" label="Course progress" />
            <span className="w-9 text-right text-xs tabular text-white/80">{progress}%</span>
          </div>
        )}
        {certificate && <a href={assetUrl(certificate.pdfUrl)} target="_blank" rel="noreferrer" className="btn btn-sm bg-pencil text-ink hover:bg-[#E9AA1D]"><Award className="h-4 w-4" /><span className="hidden sm:inline">Certificate</span></a>}
        <button type="button" onClick={() => setPanel((v) => !v)} className="btn-icon btn rounded-md text-white/80 hover:bg-white/10 hover:text-white" aria-expanded={panel} aria-label={panel ? 'Hide course content' : 'Show course content'}>
          {panel ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <main className="scroll-thin min-w-0 flex-1 overflow-y-auto" id="main">
          <LessonBody key={lessonId} courseId={courseId} lessonId={lessonId} enrolled={!!enrollment} onProgress={onProgress} goNext={goNext} hasNext={!!next} />
          <div className="mx-auto flex w-full max-w-4xl justify-between px-4 pb-10 sm:px-8">
            {previous ? <Link to={`/learn/${courseId}/${previous.id}`} className="btn-ghost btn-sm"><ChevronLeft className="h-4 w-4" />{previous.title}</Link> : <span />}
          </div>
        </main>
        {panel && (
          <>
            <div className="absolute inset-0 z-10 bg-board-950/40 lg:hidden" onClick={() => setPanel(false)} aria-hidden="true" />
            <aside className="absolute inset-y-0 right-0 z-20 w-[min(22rem,88vw)] border-l border-line bg-paper shadow-pop lg:static lg:w-80 lg:shadow-none xl:w-96">
              <Sidebar curriculum={curriculum} courseId={courseId} currentId={lessonId} onNavigate={closeOnMobile} />
            </aside>
          </>
        )}
      </div>

      <Modal open={!!celebrate} onClose={() => setCelebrate(null)} title="Course complete" width="max-w-md"
        footer={<>
          <button type="button" className="btn-outline" onClick={() => setCelebrate(null)}>Keep reviewing</button>
          {celebrate && <a href={assetUrl(`${celebrate.pdfUrl}?download=1`)} className="btn-accent"><Download className="h-4 w-4" />Download certificate</a>}
        </>}>
        <div className="text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-pencil text-board"><Check className="h-8 w-8" strokeWidth={3} aria-hidden="true" /></span>
          <p className="mt-4 font-display text-2xl font-semibold">You finished {course.title}</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">Every lesson is complete and every quiz is passed. Your certificate is ready, with ID <span className="font-semibold tabular text-ink">{celebrate?.code}</span>.</p>
        </div>
      </Modal>
    </div>
  );
}
