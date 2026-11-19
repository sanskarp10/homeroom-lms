import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import clsx from 'clsx';
import { ArrowLeft, ArrowUp, ArrowDown, Plus, ExternalLink, Pencil, Trash2, Check, X, MousePointerClick } from 'lucide-react';
import {
  useGetManageCourseQuery, usePublishCourseMutation, useAddSectionMutation, useRenameSectionMutation, useDeleteSectionMutation,
  useAddLessonMutation, useSaveOrderMutation,
} from '../../store/api.js';
import { toast } from '../../store/uiSlice.js';
import { Empty, PageLoader, Segmented, Spinner, StatusTag } from '../../components/ui.jsx';
import { LESSON_ICONS } from '../CourseDetail.jsx';
import LessonEditor from './LessonEditor.jsx';
import { DetailsTab, LiveTab } from './CourseSettings.jsx';
import { errorMessage, plural } from '../../lib/format.js';

const ADD = [['video', 'Video'], ['article', 'Reading'], ['quiz', 'Quiz']];
const DEFAULT_TITLE = { video: 'Untitled video', article: 'Untitled reading', quiz: 'Untitled quiz' };

function lessonState(lesson) {
  if (lesson.type === 'video') {
    const s = lesson.video.status;
    if (s === 'ready') return null;
    if (s === 'failed') return { text: 'Failed', tone: 'text-redpen' };
    if (s === 'none') return { text: 'No video', tone: 'text-pencil-deep' };
    return { text: `${lesson.video.progress}%`, tone: 'text-ink-faint', busy: true };
  }
  if (lesson.type === 'quiz' && lesson.quiz.questions.length === 0) return { text: 'No questions', tone: 'text-pencil-deep' };
  return null;
}

function SectionHeader({ section, index, count, courseId, onMove }) {
  const dispatch = useDispatch();
  const [rename, renameState] = useRenameSectionMutation();
  const [remove] = useDeleteSectionMutation();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(section.title);
  const save = async (e) => {
    e.preventDefault();
    if (!title.trim() || title === section.title) return setEditing(false);
    try { await rename({ id: courseId, sectionId: section.id, title }).unwrap(); setEditing(false); }
    catch (err) { dispatch(toast.error(errorMessage(err))); }
  };
  const drop = async () => {
    try { await remove({ id: courseId, sectionId: section.id }).unwrap(); } catch (err) { dispatch(toast.error(errorMessage(err))); }
  };
  if (editing) {
    return (
      <form onSubmit={save} className="flex items-center gap-1.5 border-b border-line bg-paper px-3 py-2">
        <input autoFocus className="field h-8 py-1" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Section title" />
        <button type="submit" className="btn-primary btn-icon h-8 w-8 shrink-0" aria-label="Save section title" disabled={renameState.isLoading}><Check className="h-4 w-4" /></button>
        <button type="button" className="btn-ghost btn-icon h-8 w-8 shrink-0" aria-label="Cancel" onClick={() => { setTitle(section.title); setEditing(false); }}><X className="h-4 w-4" /></button>
      </form>
    );
  }
  const icon = 'grid h-7 w-7 place-items-center rounded text-ink-faint hover:bg-board/10 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent';
  return (
    <div className="flex items-center gap-1 border-b border-line bg-paper px-3 py-2">
      <h3 className="min-w-0 flex-1 truncate font-sans text-[13px] font-semibold"><span className="text-ink-faint">Section {index + 1}.</span> {section.title}</h3>
      <button type="button" className={icon} onClick={() => setEditing(true)} aria-label={`Rename section ${section.title}`}><Pencil className="h-3.5 w-3.5" /></button>
      <button type="button" className={icon} disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move section up"><ArrowUp className="h-3.5 w-3.5" /></button>
      <button type="button" className={icon} disabled={index === count - 1} onClick={() => onMove(1)} aria-label="Move section down"><ArrowDown className="h-3.5 w-3.5" /></button>
      {section.lessons.length === 0 && count > 1 && <button type="button" className={clsx(icon, 'hover:text-redpen')} onClick={drop} aria-label={`Delete section ${section.title}`}><Trash2 className="h-3.5 w-3.5" /></button>}
    </div>
  );
}

function CurriculumTab({ course, curriculum }) {
  const dispatch = useDispatch();
  const [selected, setSelected] = useState(null);
  const [addSection, addSectionState] = useAddSectionMutation();
  const [addLesson, addLessonState] = useAddLessonMutation();
  const [saveOrder] = useSaveOrderMutation();
  const lessons = useMemo(() => curriculum.flatMap((s) => s.lessons), [curriculum]);
  const current = lessons.find((l) => l.id === selected) || null;

  const persist = (next) => saveOrder({ id: course.id, sections: next.map((s) => ({ id: s.id, lessons: s.lessons.map((l) => l.id) })) })
    .unwrap().catch((err) => dispatch(toast.error(errorMessage(err))));
  const moveSection = (index, dir) => {
    const next = [...curriculum];
    [next[index], next[index + dir]] = [next[index + dir], next[index]];
    persist(next);
  };
  // Lessons move within a section, and off its ends into the neighbouring section.
  const moveLesson = (si, li, dir) => {
    const next = curriculum.map((s) => ({ ...s, lessons: [...s.lessons] }));
    const [lesson] = next[si].lessons.splice(li, 1);
    const target = li + dir;
    if (target < 0) { if (si === 0) return; next[si - 1].lessons.push(lesson); }
    else if (target > next[si].lessons.length) { if (si === next.length - 1) return; next[si + 1].lessons.unshift(lesson); }
    else next[si].lessons.splice(target, 0, lesson);
    persist(next);
  };
  const newLesson = async (sectionId, type) => {
    try {
      const { lesson } = await addLesson({ id: course.id, sectionId, type, title: DEFAULT_TITLE[type] }).unwrap();
      setSelected(lesson.id);
    } catch (err) { dispatch(toast.error(errorMessage(err))); }
  };
  const newSection = async () => {
    try { await addSection({ id: course.id, title: `Section ${curriculum.length + 1}` }).unwrap(); }
    catch (err) { dispatch(toast.error(errorMessage(err))); }
  };
  const arrow = 'grid h-6 w-6 place-items-center rounded text-ink-faint hover:bg-board/10 hover:text-ink disabled:opacity-25 disabled:hover:bg-transparent';

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <div className="space-y-4 lg:sticky lg:top-24">
        {curriculum.map((section, si) => (
          <section key={section.id} className="panel overflow-hidden">
            <SectionHeader section={section} index={si} count={curriculum.length} courseId={course.id} onMove={(dir) => moveSection(si, dir)} />
            <ul>
              {section.lessons.map((lesson, li) => {
                const Icon = LESSON_ICONS[lesson.type];
                const state = lessonState(lesson);
                const active = lesson.id === selected;
                const first = si === 0 && li === 0;
                const last = si === curriculum.length - 1 && li === section.lessons.length - 1;
                return (
                  <li key={lesson.id} className={clsx('group flex items-center border-l-[3px] border-b border-b-line/70', active ? 'border-l-pencil bg-pencil-light/40' : 'border-l-transparent hover:bg-paper/70')}>
                    <button type="button" onClick={() => setSelected(lesson.id)} aria-current={active} className="flex min-w-0 flex-1 items-center gap-2.5 py-2.5 pl-3 pr-1 text-left text-sm focus-visible:outline-offset-[-2px]">
                      <Icon className="h-4 w-4 shrink-0 text-board-500" aria-hidden="true" />
                      <span className={clsx('min-w-0 flex-1 truncate', active ? 'font-semibold text-ink' : 'text-ink-soft')}>{lesson.title}</span>
                      {state && <span className={clsx('flex shrink-0 items-center gap-1 text-2xs font-semibold', state.tone)}>{state.busy && <Spinner className="h-3 w-3" />}{state.text}</span>}
                    </button>
                    <span className="flex shrink-0 pr-2 opacity-0 transition-opacity duration-75 focus-within:opacity-100 group-hover:opacity-100">
                      <button type="button" className={arrow} disabled={first} onClick={() => moveLesson(si, li, -1)} aria-label={`Move ${lesson.title} up`}><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button type="button" className={arrow} disabled={last} onClick={() => moveLesson(si, li, 1)} aria-label={`Move ${lesson.title} down`}><ArrowDown className="h-3.5 w-3.5" /></button>
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center gap-1.5 px-3 py-2.5">
              <span className="mr-1 flex items-center gap-1 text-xs text-ink-faint"><Plus className="h-3.5 w-3.5" aria-hidden="true" />Add</span>
              {ADD.map(([type, label]) => (
                <button key={type} type="button" disabled={addLessonState.isLoading} onClick={() => newLesson(section.id, type)} className="h-7 rounded-md border border-line-strong bg-white px-2.5 text-xs font-semibold text-ink-soft transition-colors duration-100 hover:border-board hover:text-ink">{label}</button>
              ))}
            </div>
          </section>
        ))}
        <button type="button" onClick={newSection} disabled={addSectionState.isLoading} className="btn-outline w-full border-dashed"><Plus className="h-4 w-4" />Add a section</button>
      </div>

      <div className="min-w-0">
        {current ? <LessonEditor lesson={current} courseId={course.id} onDeleted={() => setSelected(null)} /> : (
          <Empty icon={MousePointerClick} title={lessons.length ? 'Choose a lesson to edit' : 'Add your first lesson'}>
            {lessons.length ? 'Pick one from the list, or add a new video, reading or quiz to a section.' : 'Use the Add buttons under a section. Videos are converted for streaming after upload; quizzes are marked automatically.'}
          </Empty>
        )}
      </div>
    </div>
  );
}

export default function CourseEditor() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const [tab, setTab] = useState('curriculum');
  const [poll, setPoll] = useState(false);
  // Poll only while a video is queued or converting, so progress bars move on their own.
  const { data, isLoading, error } = useGetManageCourseQuery(id, { pollingInterval: poll ? 2000 : 0 });
  const [publish, publishState] = usePublishCourseMutation();
  const converting = !!data?.curriculum.some((s) => s.lessons.some((l) => ['queued', 'processing'].includes(l.video.status)));
  useEffect(() => setPoll(converting), [converting]);

  if (isLoading) return <PageLoader label="Opening the editor" />;
  if (error) return <div className="page pt-16"><Empty title="This course could not be opened" action={<Link to="/teach" className="btn-primary">Back to your courses</Link>}>{errorMessage(error)}</Empty></div>;
  const { course, curriculum } = data;
  const published = course.status === 'published';
  const lessonCount = curriculum.reduce((n, s) => n + s.lessons.length, 0);
  const problems = publishState.error?.data?.details;

  const togglePublish = async () => {
    try {
      await publish({ id, published: !published }).unwrap();
      dispatch(toast.success(published ? 'Unpublished. The course is hidden from the catalog.' : 'Published. The course is live in the catalog.'));
    } catch { window.scrollTo({ top: 0, behavior: 'smooth' }); }
  };

  return (
    <div className="page pt-8">
      <Link to="/teach" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-faint hover:text-ink"><ArrowLeft className="h-4 w-4" />Your courses</Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">{course.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-faint"><StatusTag status={course.status} />{plural(lessonCount, 'lesson')}, {plural(course.enrollmentCount, 'student')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={published ? `/courses/${course.slug}` : `/learn/${course.id}`} className="btn-outline"><ExternalLink className="h-4 w-4" />{published ? 'View page' : 'Preview as student'}</Link>
          <button type="button" onClick={togglePublish} disabled={publishState.isLoading} className={published ? 'btn-outline' : 'btn-accent'}>{publishState.isLoading && <Spinner />}{published ? 'Unpublish' : 'Publish'}</button>
        </div>
      </div>

      {publishState.error && (
        <div role="alert" className="mt-5 rounded-xl border border-redpen/25 bg-redpen-light px-4 py-3.5 text-sm text-redpen">
          <p className="font-semibold">{errorMessage(publishState.error)}</p>
          {problems?.length > 0 && <ul className="mt-1.5 list-disc space-y-0.5 pl-5">{problems.map((p) => <li key={p.message}>{p.message}</li>)}</ul>}
        </div>
      )}

      <Segmented className="mt-7" label="Editor sections" value={tab} onChange={setTab} options={[{ value: 'curriculum', label: 'Lessons' }, { value: 'details', label: 'Details and price' }, { value: 'live', label: 'Live classes' }]} />
      <div className="mt-6">
        {tab === 'curriculum' && <CurriculumTab course={course} curriculum={curriculum} />}
        {tab === 'details' && <DetailsTab course={course} />}
        {tab === 'live' && <LiveTab course={course} />}
      </div>
    </div>
  );
}
