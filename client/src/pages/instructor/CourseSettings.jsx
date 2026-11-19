import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ImageUp, Trash2, CalendarPlus, Radio } from 'lucide-react';
import {
  useUpdateCourseMutation, useUploadThumbnailMutation, useDeleteCourseMutation, useGetCategoriesQuery,
  useGetCourseLiveQuery, useCreateLiveMutation, useDeleteLiveMutation,
} from '../../store/api.js';
import { toast } from '../../store/uiSlice.js';
import CourseCover from '../../components/CourseCover.jsx';
import { Confirm, Empty, ErrorNote, Field, Spinner, StatusTag } from '../../components/ui.jsx';
import { dayLabel, timeLabel, dateLabel, errorMessage, titleCase } from '../../lib/format.js';

export function DetailsTab({ course }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const categories = useGetCategoriesQuery();
  const [update, updateState] = useUpdateCourseMutation();
  const [uploadThumb, thumbState] = useUploadThumbnailMutation();
  const [destroy, destroyState] = useDeleteCourseMutation();
  const [confirm, setConfirm] = useState(false);
  const fileRef = useRef(null);
  const toForm = (c) => ({ title: c.title, subtitle: c.subtitle || '', description: c.description || '', outcomes: (c.outcomes || []).join('\n'), category: c.category, level: c.level, price: c.price ? String(c.price / 100) : '' });
  const [form, setForm] = useState(() => toForm(course));
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setForm(toForm(course)); setDirty(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [course.id]);
  const set = (key) => (e) => { setForm({ ...form, [key]: e.target.value }); setDirty(true); };

  const save = async (e) => {
    e.preventDefault();
    try {
      await update({ id: course.id, ...form, price: Math.round(Number(form.price || 0) * 100), outcomes: form.outcomes.split('\n').map((s) => s.trim()).filter(Boolean) }).unwrap();
      setDirty(false);
      dispatch(toast.success('Course details saved.'));
    } catch { /* shown below */ }
  };
  const onThumb = async (file) => {
    if (!file) return;
    try { await uploadThumb({ id: course.id, file }).unwrap(); dispatch(toast.success('Cover image updated.')); }
    catch (err) { dispatch(toast.error(errorMessage(err))); }
  };
  const remove = async () => {
    try { await destroy(course.id).unwrap(); dispatch(toast.success('Course deleted.')); navigate('/teach'); }
    catch (err) { setConfirm(false); dispatch(toast.error(errorMessage(err))); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <form onSubmit={save} className="panel space-y-4 p-5 sm:p-6">
        <Field label="Title"><input className="field" value={form.title} onChange={set('title')} required /></Field>
        <Field label="Subtitle" hint="One sentence shown on the course card."><input className="field" maxLength={200} value={form.subtitle} onChange={set('subtitle')} /></Field>
        <Field label="Description" hint="At least 40 characters to publish. Leave a blank line between paragraphs."><textarea className="field min-h-40" value={form.description} onChange={set('description')} /></Field>
        <Field label="What students will be able to do" hint="One outcome per line."><textarea className="field min-h-28" value={form.outcomes} onChange={set('outcomes')} /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Subject"><select className="field" value={form.category} onChange={set('category')}>{(categories.data?.categories || [{ name: form.category }]).map((c) => <option key={c.name}>{c.name}</option>)}</select></Field>
          <Field label="Level"><select className="field" value={form.level} onChange={set('level')}>{(categories.data?.levels || [form.level]).map((l) => <option key={l} value={l}>{titleCase(l)}</option>)}</select></Field>
          <Field label="Price (USD)" hint="Empty or 0 means free."><input className="field tabular" type="number" min="0" step="1" value={form.price} onChange={set('price')} placeholder="0" /></Field>
        </div>
        <ErrorNote>{updateState.error && errorMessage(updateState.error)}</ErrorNote>
        <div className="flex items-center gap-3 border-t border-line pt-5">
          <button type="submit" className="btn-primary" disabled={!dirty || updateState.isLoading}>{updateState.isLoading && <Spinner />}Save details</button>
          <span className="text-sm text-ink-faint">{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
        </div>
      </form>

      <aside className="space-y-6">
        <div className="panel p-5">
          <h3 className="font-sans text-sm font-semibold">Cover</h3>
          <CourseCover course={{ ...course, title: form.title || course.title, category: form.category }} as="p" className="mt-3" />
          <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp" className="sr-only" tabIndex={-1} onChange={(e) => { onThumb(e.target.files?.[0]); e.target.value = ''; }} />
          <button type="button" className="btn-outline mt-4 w-full" onClick={() => fileRef.current?.click()} disabled={thumbState.isLoading}>{thumbState.isLoading ? <Spinner /> : <ImageUp className="h-4 w-4" />}{course.thumbnailUrl ? 'Replace image' : 'Upload an image'}</button>
          <p className="hint">Optional. Without an image, Homeroom draws this cover from the title and subject. JPG, PNG or WebP up to 5 MB.</p>
        </div>
        <div className="panel p-5">
          <h3 className="font-sans text-sm font-semibold">Delete course</h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-faint">Only courses without students can be deleted. Unpublish a course to hide it and keep access for the people who bought it.</p>
          <button type="button" className="btn-outline mt-3 w-full text-redpen hover:border-redpen hover:bg-redpen-light" onClick={() => setConfirm(true)}><Trash2 className="h-4 w-4" />Delete this course</button>
        </div>
      </aside>
      <Confirm open={confirm} onClose={() => setConfirm(false)} onConfirm={remove} busy={destroyState.isLoading} title="Delete this course?" confirmLabel="Delete course">
        “{course.title}”, its lessons and its videos are removed for good.
      </Confirm>
    </div>
  );
}

const pad = (n) => String(n).padStart(2, '0');
const localInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const defaultStart = () => { const d = new Date(Date.now() + 24 * 3600 * 1000); d.setMinutes(0, 0, 0); return localInput(d); };

export function LiveTab({ course }) {
  const dispatch = useDispatch();
  const { data, isLoading } = useGetCourseLiveQuery(course.id);
  const [create, createState] = useCreateLiveMutation();
  const [remove] = useDeleteLiveMutation();
  const [form, setForm] = useState({ title: '', description: '', scheduledAt: defaultStart(), durationMin: 60 });
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    try {
      await create({ courseId: course.id, title: form.title, description: form.description, scheduledAt: new Date(form.scheduledAt).toISOString(), durationMin: Number(form.durationMin) }).unwrap();
      setForm({ title: '', description: '', scheduledAt: defaultStart(), durationMin: 60 });
      dispatch(toast.success('Class scheduled. Enrolled students see it on their timetable.'));
    } catch { /* shown below */ }
  };
  const drop = async (id) => {
    try { await remove(id).unwrap(); dispatch(toast.success('Class removed.')); } catch (err) { dispatch(toast.error(errorMessage(err))); }
  };
  const items = data?.items || [];
  const upcoming = items.filter((c) => c.status !== 'ended').reverse();
  const past = items.filter((c) => c.status === 'ended');

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <section>
          <h3 className="mb-3 text-xl font-semibold">Scheduled</h3>
          {isLoading ? <Spinner className="text-board" /> : upcoming.length === 0 ? (
            <Empty icon={Radio} title="No class is scheduled">Use the form to schedule one. Students join from their timetable; you start the class when you are ready.</Empty>
          ) : (
            <ul className="panel divide-y divide-line">
              {upcoming.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4">
                  <div className="w-32 shrink-0"><p className="text-sm font-semibold">{c.status === 'live' ? 'Live now' : dayLabel(c.scheduledAt)}</p><p className="text-sm tabular text-ink-faint">{timeLabel(c.scheduledAt)}, {c.durationMin} min</p></div>
                  <div className="min-w-0 flex-1"><p className="font-semibold">{c.title}</p>{c.description && <p className="mt-0.5 text-sm text-ink-faint">{c.description}</p>}</div>
                  {c.status === 'live' && <StatusTag status="live">Live</StatusTag>}
                  <div className="flex gap-2">
                    <Link to={`/live/${c.id}`} className={c.status === 'live' ? 'btn-accent btn-sm' : 'btn-primary btn-sm'}>{c.status === 'live' ? 'Rejoin' : 'Open classroom'}</Link>
                    {c.status !== 'live' && <button type="button" onClick={() => drop(c.id)} className="btn-ghost btn-icon h-8 w-8 text-redpen hover:text-redpen" aria-label={`Remove ${c.title}`}><Trash2 className="h-4 w-4" /></button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        {past.length > 0 && (
          <section>
            <h3 className="mb-3 text-xl font-semibold">Past classes</h3>
            <ul className="panel divide-y divide-line text-sm">
              {past.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <Link to={`/live/${c.id}`} className="min-w-0 truncate font-semibold hover:underline">{c.title}</Link>
                  <span className="shrink-0 text-xs text-ink-faint">{dateLabel(c.endedAt || c.scheduledAt)}, peak attendance {c.peakAttendance}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <form onSubmit={submit} className="panel h-fit space-y-4 p-5">
        <h3 className="flex items-center gap-2 font-sans text-[15px] font-semibold"><CalendarPlus className="h-4 w-4 text-board-500" aria-hidden="true" />Schedule a live class</h3>
        <Field label="Title"><input className="field" value={form.title} onChange={set('title')} placeholder="For example: Week 2 questions" required /></Field>
        <Field label="What will happen" hint="Optional."><textarea className="field" rows={2} value={form.description} onChange={set('description')} /></Field>
        <Field label="Starts" hint="In your local time."><input type="datetime-local" className="field tabular" value={form.scheduledAt} onChange={set('scheduledAt')} required /></Field>
        <Field label="Length (minutes)"><input type="number" min="5" max="480" step="5" className="field tabular" value={form.durationMin} onChange={set('durationMin')} required /></Field>
        <ErrorNote>{createState.error && errorMessage(createState.error)}</ErrorNote>
        <button type="submit" className="btn-primary w-full" disabled={createState.isLoading}>{createState.isLoading && <Spinner />}Schedule class</button>
      </form>
    </div>
  );
}
