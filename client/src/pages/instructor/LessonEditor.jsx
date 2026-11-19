import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import clsx from 'clsx';
import { UploadCloud, Trash2, Plus, X, RefreshCw, CircleCheck, TriangleAlert, Eye, PencilLine } from 'lucide-react';
import { uploadLessonVideo, useUpdateLessonMutation, useDeleteLessonMutation, useRemoveVideoMutation } from '../../store/api.js';
import { selectToken } from '../../store/authSlice.js';
import { toast } from '../../store/uiSlice.js';
import VideoPlayer from '../../components/VideoPlayer.jsx';
import { Markdown } from '../../lib/markdown.jsx';
import { Confirm, ErrorNote, Field, ProgressBar, Segmented, Spinner } from '../../components/ui.jsx';
import { duration, errorMessage } from '../../lib/format.js';

const ACCEPT = '.mp4,.mov,.m4v,.mkv,.webm,.avi,video/*';

function VideoUploader({ lesson, courseId }) {
  const dispatch = useDispatch();
  const token = useSelector(selectToken);
  const [removeVideo, removeState] = useRemoveVideoMutation();
  const [upload, setUpload] = useState(null); // { percent, name, cancel }
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);
  const inputRef = useRef(null);
  const { video } = lesson;

  const startUpload = (file) => {
    if (!file) return;
    setError('');
    const job = uploadLessonVideo({ lessonId: lesson.id, courseId, file, token, dispatch, onProgress: (percent) => setUpload((u) => u && { ...u, percent }) });
    setUpload({ percent: 0, name: file.name, cancel: job.cancel });
    job.promise
      .then(() => dispatch(toast.success('Upload finished. Converting the video for streaming now.')))
      .catch((err) => err.message !== 'Upload cancelled.' && setError(err.message))
      .finally(() => setUpload(null));
  };
  const pick = () => inputRef.current?.click();
  const input = <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} onChange={(e) => { startUpload(e.target.files?.[0]); e.target.value = ''; }} />;

  if (upload) {
    return (
      <div className="rounded-xl border border-line bg-paper/60 p-5">
        <div className="flex items-center justify-between gap-3 text-sm"><p className="min-w-0 truncate font-semibold">Uploading {upload.name}</p><span className="tabular text-ink-faint">{upload.percent}%</span></div>
        <ProgressBar value={upload.percent} tone="board" className="mt-3 h-2" label="Upload progress" />
        <button type="button" onClick={upload.cancel} className="btn-ghost btn-sm mt-3">Cancel upload</button>
      </div>
    );
  }
  if (video.status === 'queued' || video.status === 'processing') {
    return (
      <div className="rounded-xl border border-line bg-paper/60 p-5" role="status">
        <div className="flex items-center justify-between gap-3 text-sm">
          <p className="flex items-center gap-2 font-semibold"><Spinner className="text-board" />{video.status === 'queued' ? 'Waiting in the queue' : 'Converting for streaming'}</p>
          <span className="tabular text-ink-faint">{video.progress}%</span>
        </div>
        <ProgressBar value={video.progress} className="mt-3 h-2" label="Conversion progress" />
        <p className="mt-3 text-xs text-ink-faint">{video.originalName}. FFmpeg is producing several quality levels in the background. You can keep editing, or leave this page.</p>
      </div>
    );
  }
  if (video.status === 'ready') {
    return (
      <div>
        <VideoPlayer src={video.url} poster={video.posterUrl} className="rounded-xl" title={lesson.title} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-sm text-ink-soft"><CircleCheck className="h-4 w-4 text-pass" aria-hidden="true" />Ready to stream, {duration(video.duration)}, in {video.renditions.map((r) => `${r}p`).join(' and ')}</p>
          <div className="flex gap-2">
            {input}
            <button type="button" onClick={pick} className="btn-outline btn-sm"><RefreshCw className="h-3.5 w-3.5" />Replace video</button>
            <button type="button" onClick={() => removeVideo({ lessonId: lesson.id, courseId })} disabled={removeState.isLoading} className="btn-ghost btn-sm text-redpen hover:text-redpen">Remove</button>
          </div>
        </div>
        <ErrorNote className="mt-3">{error}</ErrorNote>
      </div>
    );
  }
  return (
    <div>
      {video.status === 'failed' && (
        <p className="mb-3 flex items-start gap-2 rounded-lg border border-redpen/25 bg-redpen-light px-3.5 py-3 text-sm text-redpen" role="alert">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span>The last video could not be converted. {video.error} Upload it again, or try a different file.</span>
        </p>
      )}
      <div onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); startUpload(e.dataTransfer.files?.[0]); }}
        className={clsx('grid place-items-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors duration-100', over ? 'border-board bg-chalk' : 'border-line-strong bg-paper/50')}>
        <UploadCloud className="h-8 w-8 text-board-500" strokeWidth={1.6} aria-hidden="true" />
        <p className="mt-3 font-semibold">Drop a video here</p>
        <p className="mt-1 text-sm text-ink-faint">MP4, MOV, MKV or WebM. It is converted to adaptive streaming automatically.</p>
        {input}
        <button type="button" onClick={pick} className="btn-primary mt-4">Choose a file</button>
      </div>
      <ErrorNote className="mt-3">{error}</ErrorNote>
    </div>
  );
}

const blankQuestion = () => ({ prompt: '', type: 'single', options: ['', ''], correct: [0], points: 1, explanation: '' });

function QuizBuilder({ quiz, onChange }) {
  const setQuestion = (index, changes) => onChange({ ...quiz, questions: quiz.questions.map((q, i) => (i === index ? { ...q, ...changes } : q)) });
  const changeType = (index, type) => {
    const q = quiz.questions[index];
    if (type === 'boolean') return setQuestion(index, { type, options: ['True', 'False'], correct: [Math.min(q.correct[0] ?? 0, 1)] });
    setQuestion(index, { type, options: q.type === 'boolean' ? ['', ''] : q.options, correct: type === 'single' ? [q.correct[0] ?? 0] : q.correct });
  };
  const toggleCorrect = (index, option) => {
    const q = quiz.questions[index];
    if (q.type !== 'multiple') return setQuestion(index, { correct: [option] });
    const next = q.correct.includes(option) ? q.correct.filter((i) => i !== option) : [...q.correct, option];
    setQuestion(index, { correct: next });
  };
  const removeOption = (index, option) => {
    const q = quiz.questions[index];
    const correct = q.correct.filter((i) => i !== option).map((i) => (i > option ? i - 1 : i));
    setQuestion(index, { options: q.options.filter((_, i) => i !== option), correct: correct.length || q.type === 'multiple' ? correct : [0] });
  };

  return (
    <div className="space-y-5">
      <Field label="Pass mark (%)" className="max-w-[10rem]"><input type="number" min="0" max="100" className="field tabular" value={quiz.passingPercent} onChange={(e) => onChange({ ...quiz, passingPercent: e.target.value })} /></Field>
      {quiz.questions.map((q, index) => (
        <fieldset key={q.id || `new-${index}`} className="rounded-xl border border-line bg-paper/50 p-4">
          <div className="flex items-center justify-between gap-3">
            <legend className="float-left text-sm font-semibold">Question {index + 1}</legend>
            <button type="button" onClick={() => onChange({ ...quiz, questions: quiz.questions.filter((_, i) => i !== index) })} className="btn-ghost btn-sm text-redpen hover:text-redpen"><Trash2 className="h-3.5 w-3.5" />Remove</button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
            <Field label="Question"><textarea className="field min-h-[2.75rem]" rows={2} value={q.prompt} onChange={(e) => setQuestion(index, { prompt: e.target.value })} /></Field>
            <Field label="Answer type">
              <select className="field" value={q.type} onChange={(e) => changeType(index, e.target.value)}>
                <option value="single">One correct answer</option><option value="multiple">Several correct</option><option value="boolean">True or false</option>
              </select>
            </Field>
          </div>
          <p className="label mt-4">Answers <span className="font-normal text-ink-faint">(tick the correct {q.type === 'multiple' ? 'ones' : 'one'})</span></p>
          <ul className="space-y-2">
            {q.options.map((option, oi) => (
              <li key={oi} className="flex items-center gap-2.5">
                <input type={q.type === 'multiple' ? 'checkbox' : 'radio'} name={`correct-${index}`} checked={q.correct.includes(oi)} onChange={() => toggleCorrect(index, oi)} className="h-4 w-4 shrink-0 accent-[#1E7A53]" aria-label={`Mark answer ${oi + 1} as correct`} />
                <input className={clsx('field', q.correct.includes(oi) && 'border-pass bg-pass-light/50')} value={option} disabled={q.type === 'boolean'} placeholder={`Answer ${oi + 1}`}
                  onChange={(e) => setQuestion(index, { options: q.options.map((o, i) => (i === oi ? e.target.value : o)) })} />
                {q.type !== 'boolean' && q.options.length > 2 && <button type="button" onClick={() => removeOption(index, oi)} className="btn-ghost btn-icon shrink-0" aria-label={`Remove answer ${oi + 1}`}><X className="h-4 w-4" /></button>}
              </li>
            ))}
          </ul>
          {q.type !== 'boolean' && q.options.length < 8 && <button type="button" onClick={() => setQuestion(index, { options: [...q.options, ''] })} className="btn-ghost btn-sm mt-2"><Plus className="h-3.5 w-3.5" />Add an answer</button>}
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
            <Field label="Explanation shown after marking" hint="Optional, but it is where most of the learning happens."><input className="field" value={q.explanation} onChange={(e) => setQuestion(index, { explanation: e.target.value })} /></Field>
            <Field label="Points"><input type="number" min="0" max="100" className="field tabular" value={q.points} onChange={(e) => setQuestion(index, { points: e.target.value })} /></Field>
          </div>
        </fieldset>
      ))}
      <button type="button" onClick={() => onChange({ ...quiz, questions: [...quiz.questions, blankQuestion()] })} className="btn-outline"><Plus className="h-4 w-4" />Add a question</button>
    </div>
  );
}

const TYPE_NAME = { video: 'Video lesson', article: 'Reading', quiz: 'Quiz' };

export default function LessonEditor({ lesson, courseId, onDeleted }) {
  const dispatch = useDispatch();
  const [update, updateState] = useUpdateLessonMutation();
  const [remove, removeState] = useDeleteLessonMutation();
  const [form, setForm] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [mode, setMode] = useState('write');

  // Load the lesson into the form when a different lesson is selected (not on every background refresh).
  useEffect(() => {
    setForm({ title: lesson.title, isPreview: lesson.isPreview, content: lesson.content, quiz: lesson.quiz });
    setDirty(false);
    setMode('write');
    updateState.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);
  if (!form) return null;
  const set = (changes) => { setForm((f) => ({ ...f, ...changes })); setDirty(true); };

  const save = async (e) => {
    e?.preventDefault();
    const body = { lessonId: lesson.id, courseId, title: form.title, content: form.content };
    if (lesson.type === 'video') body.isPreview = form.isPreview;
    if (lesson.type === 'quiz') {
      body.quiz = {
        passingPercent: Number(form.quiz.passingPercent) || 0,
        questions: form.quiz.questions.map(({ id: _id, ...q }) => ({ ...q, points: Number(q.points) || 0 })),
      };
    }
    try {
      const result = await update(body).unwrap();
      setForm((f) => ({ ...f, quiz: result.lesson.quiz }));
      setDirty(false);
      dispatch(toast.success('Lesson saved.'));
    } catch { /* shown below */ }
  };
  const destroy = async () => {
    try { await remove({ lessonId: lesson.id, courseId }).unwrap(); setConfirm(false); dispatch(toast.success('Lesson deleted.')); onDeleted(); }
    catch (err) { dispatch(toast.error(errorMessage(err))); }
  };

  return (
    <form onSubmit={save} className="panel p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink-faint">{TYPE_NAME[lesson.type]}</p>
        <button type="button" onClick={() => setConfirm(true)} className="btn-ghost btn-sm text-redpen hover:text-redpen"><Trash2 className="h-3.5 w-3.5" />Delete lesson</button>
      </div>
      <Field label="Lesson title" className="mt-3"><input className="field h-11 text-base font-semibold" value={form.title} onChange={(e) => set({ title: e.target.value })} required /></Field>

      {lesson.type === 'video' && (
        <>
          <div className="mt-5"><VideoUploader lesson={lesson} courseId={courseId} /></div>
          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-line px-4 py-3">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#1F3A33]" checked={form.isPreview} onChange={(e) => set({ isPreview: e.target.checked })} />
            <span><span className="block text-sm font-semibold">Free preview</span><span className="block text-xs text-ink-faint">Anyone can watch this lesson from the course page before enrolling.</span></span>
          </label>
          <Field label="Notes shown under the video" hint="Optional. Markdown is supported." className="mt-5"><textarea className="field min-h-24" value={form.content} onChange={(e) => set({ content: e.target.value })} /></Field>
        </>
      )}

      {lesson.type === 'article' && (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="label mb-0">Lesson text</span>
            <Segmented size="sm" label="Editor mode" value={mode} onChange={setMode} options={[{ value: 'write', label: <span className="flex items-center gap-1.5"><PencilLine className="h-3.5 w-3.5" />Write</span> }, { value: 'preview', label: <span className="flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" />Preview</span> }]} />
          </div>
          {mode === 'write'
            ? <textarea className="field min-h-[22rem] font-mono text-[13px] leading-relaxed" value={form.content} onChange={(e) => set({ content: e.target.value })} placeholder={'## A heading\n\nA paragraph with **bold** text and `code`.\n\n- A list item\n- Another one'} />
            : <div className="min-h-[22rem] rounded-lg border border-line bg-paper/40 p-5"><Markdown source={form.content || 'Nothing to preview yet.'} /></div>}
          <p className="hint">Markdown: ## headings, **bold**, *italic*, `code`, lists and [links](https://example.com).</p>
        </div>
      )}

      {lesson.type === 'quiz' && <div className="mt-5"><QuizBuilder quiz={form.quiz} onChange={(quiz) => set({ quiz })} /></div>}

      <ErrorNote className="mt-5">{updateState.error && errorMessage(updateState.error)}</ErrorNote>
      <div className="mt-6 flex items-center gap-3 border-t border-line pt-5">
        <button type="submit" className="btn-primary" disabled={!dirty || updateState.isLoading}>{updateState.isLoading && <Spinner />}Save lesson</button>
        <span className="text-sm text-ink-faint" aria-live="polite">{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
      </div>
      <Confirm open={confirm} onClose={() => setConfirm(false)} onConfirm={destroy} busy={removeState.isLoading} title="Delete this lesson?" confirmLabel="Delete lesson">
        “{lesson.title}” and its {lesson.type === 'video' ? 'video' : 'content'} are removed for good. Students who completed it lose that tick.
      </Confirm>
    </form>
  );
}
