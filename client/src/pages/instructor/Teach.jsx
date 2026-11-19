import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Plus, TrendingUp, TrendingDown, Presentation, ExternalLink } from 'lucide-react';
import { useGetDashboardQuery, useGetMyCoursesQuery, useCreateCourseMutation, useGetCategoriesQuery } from '../../store/api.js';
import { toast } from '../../store/uiSlice.js';
import RevenueChart from '../../components/RevenueChart.jsx';
import { subjectColor } from '../../components/CourseCover.jsx';
import { Empty, ErrorNote, Field, Modal, ProgressBar, Segmented, Skeleton, Spinner, StatusTag } from '../../components/ui.jsx';
import { amount, money, plural, fromNow, dateLabel, errorMessage } from '../../lib/format.js';

function Stat({ label, value, sub, delta }) {
  return (
    <div className="panel p-5">
      <p className="text-[13px] font-semibold text-ink-faint">{label}</p>
      <p className="mt-1.5 font-display text-3xl font-semibold tabular">{value}</p>
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-faint">
        {delta != null && Number.isFinite(delta) && (
          <span className={delta >= 0 ? 'flex items-center gap-0.5 font-semibold text-pass' : 'flex items-center gap-0.5 font-semibold text-redpen'}>
            {delta >= 0 ? <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" /> : <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />}{delta >= 0 ? '+' : ''}{delta}%
          </span>
        )}
        {sub}
      </p>
    </div>
  );
}

function NewCourse({ open, onClose }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const categories = useGetCategoriesQuery();
  const [create, { isLoading, error, reset }] = useCreateCourseMutation();
  const [form, setForm] = useState({ title: '', category: 'Web Development', price: '' });
  const submit = async (e) => {
    e.preventDefault();
    try {
      const { course } = await create({ title: form.title, category: form.category, price: Math.round(Number(form.price || 0) * 100) }).unwrap();
      dispatch(toast.success('Draft created. Add your first lesson.'));
      navigate(`/teach/courses/${course.id}`);
    } catch { /* shown in the form */ }
  };
  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="New course"
      footer={<><button type="button" className="btn-outline" onClick={onClose}>Cancel</button><button type="submit" form="new-course" className="btn-primary" disabled={isLoading}>{isLoading && <Spinner />}Create draft</button></>}>
      <form id="new-course" onSubmit={submit} className="space-y-4">
        <ErrorNote>{error && errorMessage(error)}</ErrorNote>
        <Field label="Course title" hint="You can change this until the course is published."><input className="field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="For example: Watercolour for beginners" required /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Subject"><select className="field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{(categories.data?.categories || []).map((c) => <option key={c.name}>{c.name}</option>)}</select></Field>
          <Field label="Price (USD)" hint="Leave empty for a free course."><input className="field tabular" type="number" min="0" step="1" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0" /></Field>
        </div>
      </form>
    </Modal>
  );
}

export default function Teach() {
  const [days, setDays] = useState(30);
  const [creating, setCreating] = useState(false);
  const dash = useGetDashboardQuery(days);
  const mine = useGetMyCoursesQuery();
  const d = dash.data;
  const delta = d && d.previous.net > 0 ? Math.round(((d.range.net - d.previous.net) / d.previous.net) * 100) : null;
  const statsByCourse = new Map((d?.courses || []).map((c) => [c.id, c]));

  return (
    <div className="page pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold sm:text-5xl">Teach</h1>
          <p className="mt-2 text-ink-soft">Your earnings, your students and your courses.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New course</button>
      </div>

      <section className="mt-9" aria-labelledby="earnings">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="earnings" className="text-2xl font-semibold">Earnings</h2>
          <Segmented label="Period" size="sm" value={days} onChange={setDays} options={[{ value: 7, label: '7 days' }, { value: 30, label: '30 days' }, { value: 90, label: '90 days' }, { value: 365, label: '12 months' }]} />
        </div>
        {dash.isLoading && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-panel" />)}</div>}
        {dash.error && <ErrorNote>{errorMessage(dash.error)}</ErrorNote>}
        {d && (
          <div className={dash.isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label={`Your earnings, last ${days === 365 ? '12 months' : `${days} days`}`} value={amount(d.range.net, d.currency)} delta={delta} sub={delta != null ? 'against the period before' : `${amount(d.range.gross, d.currency)} in sales`} />
              <Stat label="Sales in this period" value={d.range.sales.toLocaleString()} sub={`${amount(d.range.gross, d.currency)} paid by students`} />
              <Stat label="Students" value={d.students.toLocaleString()} sub="across all your courses" />
              <Stat label="Earned all time" value={amount(d.lifetime.net, d.currency)} sub={`from ${plural(d.lifetime.sales, 'sale')}`} />
            </div>

            <div className="panel mt-4 p-5 sm:p-6">
              <RevenueChart series={d.series} currency={d.currency} />
              <p className="mt-4 border-t border-line pt-3 text-xs text-ink-faint">
                Earnings are what you keep after the {d.platformFeePercent}% Homeroom fee. In this period students paid {amount(d.range.gross, d.currency)}; the fee was {amount(d.range.fees, d.currency)}.
              </p>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <div className="panel overflow-hidden">
                <h3 className="border-b border-line px-5 py-4 font-sans text-[15px] font-semibold">By course, all time</h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[34rem] text-sm">
                    <thead><tr className="text-left text-xs text-ink-faint"><th className="px-5 py-2.5 font-semibold">Course</th><th className="px-3 py-2.5 text-right font-semibold">Students</th><th className="px-3 py-2.5 font-semibold">Average progress</th><th className="px-5 py-2.5 text-right font-semibold">Earned</th></tr></thead>
                    <tbody className="divide-y divide-line">
                      {d.courses.map((c) => (
                        <tr key={c.id}>
                          <td className="px-5 py-3"><Link to={`/teach/courses/${c.id}`} className="font-semibold hover:underline">{c.title}</Link><p className="text-xs text-ink-faint">{money(c.price, d.currency)}{c.status !== 'published' && `, ${c.status}`}</p></td>
                          <td className="px-3 py-3 text-right tabular">{c.students}</td>
                          <td className="px-3 py-3"><div className="flex items-center gap-2"><ProgressBar value={c.avgProgress} tone="board" className="w-20" /><span className="text-xs tabular text-ink-faint">{c.avgProgress}%</span></div></td>
                          <td className="px-5 py-3 text-right font-semibold tabular">{amount(c.net, d.currency)}</td>
                        </tr>
                      ))}
                      {d.courses.length === 0 && <tr><td colSpan={4} className="px-5 py-6 text-center text-ink-faint">No courses yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="panel">
                <h3 className="border-b border-line px-5 py-4 font-sans text-[15px] font-semibold">Recent sales</h3>
                <ul className="divide-y divide-line">
                  {d.recent.slice(0, 7).map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                      <div className="min-w-0"><p className="truncate font-semibold">{o.student?.name || 'Deleted account'}</p><p className="truncate text-xs text-ink-faint">{o.course?.title}, <time dateTime={o.paidAt} title={dateLabel(o.paidAt)}>{fromNow(o.paidAt)}</time></p></div>
                      <span className="shrink-0 font-semibold tabular text-pass">+{amount(o.net, d.currency)}</span>
                    </li>
                  ))}
                  {d.recent.length === 0 && <li className="px-5 py-6 text-center text-sm text-ink-faint">Sales appear here as they happen.</li>}
                </ul>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="mt-12" aria-labelledby="courses">
        <h2 id="courses" className="mb-4 text-2xl font-semibold">Your courses</h2>
        {mine.isLoading && <Skeleton className="h-40 rounded-panel" />}
        {mine.data?.items.length === 0 && <Empty icon={Presentation} title="You have not created a course yet" action={<button type="button" className="btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New course</button>}>Start a draft, add lessons, then publish when it is ready.</Empty>}
        {mine.data?.items.length > 0 && (
          <ul className="grid gap-4 md:grid-cols-2">
            {mine.data.items.map((c) => {
              const s = statsByCourse.get(c.id);
              return (
                <li key={c.id} className="panel flex gap-4 p-4">
                  <span className="w-2 shrink-0 rounded-sm" style={{ backgroundColor: subjectColor(c.category) }} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-display text-lg font-semibold leading-snug"><Link to={`/teach/courses/${c.id}`} className="hover:underline">{c.title}</Link></h3>
                      <StatusTag status={c.status} />
                    </div>
                    <p className="mt-1 text-xs text-ink-faint">{plural(c.lessonCount, 'lesson')}, {plural(c.enrollmentCount, 'student')}, {money(c.price)}{s ? `, ${amount(s.net)} earned` : ''}</p>
                    <div className="mt-3 flex gap-2">
                      <Link to={`/teach/courses/${c.id}`} className="btn-outline btn-sm">Edit</Link>
                      {c.status === 'published' && <Link to={`/courses/${c.slug}`} className="btn-ghost btn-sm"><ExternalLink className="h-3.5 w-3.5" />View page</Link>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <NewCourse open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
