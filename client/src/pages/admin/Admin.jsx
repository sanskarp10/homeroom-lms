import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Search } from 'lucide-react';
import { useGetAdminOverviewQuery, useGetAdminUsersQuery, useUpdateAdminUserMutation, useGetAdminCoursesQuery, useUpdateAdminCourseMutation } from '../../store/api.js';
import { selectUser } from '../../store/authSlice.js';
import { toast } from '../../store/uiSlice.js';
import { Avatar, ErrorNote, Segmented, Skeleton, StatusTag } from '../../components/ui.jsx';
import { amount, dateLabel, fromNow, errorMessage, money, plural } from '../../lib/format.js';

function Tile({ label, value, sub }) {
  return <div className="panel p-5"><p className="text-[13px] font-semibold text-ink-faint">{label}</p><p className="mt-1.5 font-display text-3xl font-semibold tabular">{value}</p>{sub && <p className="mt-1.5 text-xs text-ink-faint">{sub}</p>}</div>;
}

function Overview() {
  const { data: d, isLoading, error } = useGetAdminOverviewQuery(undefined, { pollingInterval: 30000 });
  if (isLoading) return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-28 rounded-panel" />)}</div>;
  if (error) return <ErrorNote>{errorMessage(error)}</ErrorNote>;
  const users = (d.users.student || 0) + (d.users.instructor || 0) + (d.users.admin || 0);
  const v = d.videos;
  const inFlight = (v.queued || 0) + (v.processing || 0);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Sales, all time" value={amount(d.revenue.gross, d.currency)} sub={`${plural(d.revenue.sales, 'order')}, ${amount(d.revenue.fees, d.currency)} in platform fees`} />
        <Tile label="Sales, last 30 days" value={amount(d.revenue30.gross, d.currency)} sub={`${plural(d.revenue30.sales, 'order')}, ${amount(d.revenue30.fees, d.currency)} in fees`} />
        <Tile label="People" value={users.toLocaleString()} sub={`${d.users.student || 0} students, ${d.users.instructor || 0} instructors, ${d.users.admin || 0} admins`} />
        <Tile label="Published courses" value={d.courses.published || 0} sub={`${d.courses.draft || 0} drafts, ${d.courses.archived || 0} archived`} />
        <Tile label="Enrollments" value={d.enrollments.toLocaleString()} sub={`${plural(d.certificates, 'certificate')} issued`} />
        <Tile label="Live right now" value={d.liveNow} sub={d.liveNow === 1 ? 'class in session' : 'classes in session'} />
        <Tile label="Videos ready" value={v.ready || 0} sub={`${inFlight} converting, ${v.failed || 0} failed, ${v.none || 0} lessons without video`} />
        <Tile label="Video queue" value={d.queue.driver === 'bullmq' ? 'BullMQ' : 'In-process'} sub={d.queue.jobs ? `${d.queue.jobs.waiting} waiting, ${d.queue.jobs.active} active, ${d.queue.jobs.failed} failed` : 'Redis is not connected, so jobs run inside the API'} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel">
          <h3 className="border-b border-line px-5 py-4 font-sans text-[15px] font-semibold">Latest orders</h3>
          <ul className="divide-y divide-line">
            {d.recentOrders.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0"><p className="truncate font-semibold">{o.student}</p><p className="truncate text-xs text-ink-faint">{o.course?.title}, {fromNow(o.paidAt)}</p></div>
                <div className="shrink-0 text-right"><p className="font-semibold tabular">{amount(o.amount, d.currency)}</p><p className="text-xs tabular text-ink-faint">fee {amount(o.fee, d.currency)}</p></div>
              </li>
            ))}
            {d.recentOrders.length === 0 && <li className="px-5 py-6 text-center text-sm text-ink-faint">No orders yet.</li>}
          </ul>
        </div>
        <div className="panel">
          <h3 className="border-b border-line px-5 py-4 font-sans text-[15px] font-semibold">Most enrolled courses</h3>
          <ul className="divide-y divide-line">
            {d.topCourses.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0"><Link to={`/courses/${c.slug}`} className="block truncate font-semibold hover:underline">{c.title}</Link><p className="truncate text-xs text-ink-faint">{c.instructor?.name}, {money(c.price)}</p></div>
                <span className="shrink-0 tabular text-ink-soft">{plural(c.enrollmentCount, 'student')}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

function Users() {
  const me = useSelector(selectUser);
  const dispatch = useDispatch();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const query = useDebounced(q);
  useEffect(() => setPage(1), [query, role]);
  const { data, isLoading, isFetching, error } = useGetAdminUsersQuery({ page, ...(query && { q: query }), ...(role && { role }) });
  const [update] = useUpdateAdminUserMutation();
  const change = async (user, body, message) => {
    try { await update({ id: user.id, ...body }).unwrap(); dispatch(toast.success(message)); }
    catch (err) { dispatch(toast.error(errorMessage(err))); }
  };
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative block w-full max-w-xs"><span className="sr-only">Search people</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
          <input type="search" className="field pl-9" placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <Segmented size="sm" label="Role" value={role} onChange={setRole} options={[{ value: '', label: 'Everyone' }, { value: 'student', label: 'Students' }, { value: 'instructor', label: 'Instructors' }, { value: 'admin', label: 'Admins' }]} />
        {data && <span className="text-sm text-ink-faint">{plural(data.total, 'person', 'people')}</span>}
      </div>
      <ErrorNote>{error && errorMessage(error)}</ErrorNote>
      <div className={`panel overflow-x-auto transition-opacity ${isFetching && !isLoading ? 'opacity-60' : ''}`}>
        <table className="w-full min-w-[40rem] text-sm">
          <thead><tr className="border-b border-line text-left text-xs text-ink-faint"><th className="px-5 py-3 font-semibold">Person</th><th className="px-3 py-3 font-semibold">Joined</th><th className="px-3 py-3 font-semibold">Role</th><th className="px-5 py-3 text-right font-semibold">Access</th></tr></thead>
          <tbody className="divide-y divide-line">
            {isLoading && Array.from({ length: 6 }, (_, i) => <tr key={i}><td colSpan={4} className="px-5 py-3"><Skeleton className="h-8" /></td></tr>)}
            {data?.items.map((u) => {
              const self = u.id === me.id;
              return (
                <tr key={u.id} className={u.disabled ? 'bg-paper/70 text-ink-faint' : ''}>
                  <td className="px-5 py-3"><div className="flex items-center gap-3"><Avatar name={u.name} size={32} /><div className="min-w-0"><p className="truncate font-semibold text-ink">{u.name}{self && ' (you)'}</p><p className="truncate text-xs text-ink-faint">{u.email}</p></div></div></td>
                  <td className="px-3 py-3 text-xs tabular text-ink-faint">{dateLabel(u.createdAt)}</td>
                  <td className="px-3 py-3">
                    <select aria-label={`Role of ${u.name}`} className="field h-8 w-36 py-1 text-[13px]" value={u.role} disabled={self} onChange={(e) => change(u, { role: e.target.value }, `${u.name} is now ${e.target.value === 'admin' ? 'an' : 'a'} ${e.target.value}.`)}>
                      <option value="student">Student</option><option value="instructor">Instructor</option><option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {self ? <span className="text-xs text-ink-faint">Signed in</span> : (
                      <button type="button" className={u.disabled ? 'btn-outline btn-sm' : 'btn-ghost btn-sm text-redpen hover:text-redpen'} onClick={() => change(u, { disabled: !u.disabled }, u.disabled ? `${u.name} can sign in again.` : `${u.name} can no longer sign in.`)}>{u.disabled ? 'Restore access' : 'Disable'}</button>
                    )}
                  </td>
                </tr>
              );
            })}
            {data?.items.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-ink-faint">Nobody matches this search.</td></tr>}
          </tbody>
        </table>
      </div>
      {data && data.pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-3 text-sm">
          <button type="button" className="btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="tabular text-ink-faint">Page {data.page} of {data.pages}</span>
          <button type="button" className="btn-outline btn-sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}

function Courses() {
  const dispatch = useDispatch();
  const [status, setStatus] = useState('');
  const { data, isLoading, error } = useGetAdminCoursesQuery(status ? { status } : {});
  const [update] = useUpdateAdminCourseMutation();
  const change = async (course, next) => {
    try { await update({ id: course.id, status: next }).unwrap(); dispatch(toast.success(`“${course.title}” is now ${next}.`)); }
    catch (err) { dispatch(toast.error(errorMessage(err))); }
  };
  return (
    <div>
      <Segmented className="mb-4" size="sm" label="Status" value={status} onChange={setStatus} options={[{ value: '', label: 'All' }, { value: 'published', label: 'Published' }, { value: 'draft', label: 'Drafts' }, { value: 'archived', label: 'Archived' }]} />
      <ErrorNote>{error && errorMessage(error)}</ErrorNote>
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <thead><tr className="border-b border-line text-left text-xs text-ink-faint"><th className="px-5 py-3 font-semibold">Course</th><th className="px-3 py-3 font-semibold">Instructor</th><th className="px-3 py-3 text-right font-semibold">Students</th><th className="px-3 py-3 text-right font-semibold">Price</th><th className="px-5 py-3 font-semibold">Status</th></tr></thead>
          <tbody className="divide-y divide-line">
            {isLoading && Array.from({ length: 6 }, (_, i) => <tr key={i}><td colSpan={5} className="px-5 py-3"><Skeleton className="h-8" /></td></tr>)}
            {data?.items.map((c) => (
              <tr key={c.id}>
                <td className="px-5 py-3"><Link to={c.status === 'published' ? `/courses/${c.slug}` : `/teach/courses/${c.id}`} className="font-semibold hover:underline">{c.title}</Link><p className="text-xs text-ink-faint">{c.category}, {plural(c.lessonCount, 'lesson')}</p></td>
                <td className="px-3 py-3 text-ink-soft">{c.instructor?.name}</td>
                <td className="px-3 py-3 text-right tabular">{c.enrollmentCount}</td>
                <td className="px-3 py-3 text-right tabular">{money(c.price)}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <StatusTag status={c.status} className="hidden sm:inline-flex" />
                    <select aria-label={`Status of ${c.title}`} className="field h-8 w-32 py-1 text-[13px]" value={c.status} onChange={(e) => change(c, e.target.value)}>
                      <option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option>
                    </select>
                  </div>
                </td>
              </tr>
            ))}
            {data?.items.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-ink-faint">No courses with this status.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-faint">Archiving removes a course from the catalog. Students who already enrolled keep their access.</p>
    </div>
  );
}

export default function Admin() {
  const [tab, setTab] = useState('overview');
  return (
    <div className="page pt-10">
      <h1 className="text-4xl font-semibold sm:text-5xl">Admin</h1>
      <p className="mt-2 text-ink-soft">The whole school at a glance: sales, people, courses and the video pipeline.</p>
      <Segmented className="mt-7" label="Admin sections" value={tab} onChange={setTab} options={[{ value: 'overview', label: 'Overview' }, { value: 'users', label: 'People' }, { value: 'courses', label: 'Courses' }]} />
      <div className="mt-6">{tab === 'overview' ? <Overview /> : tab === 'users' ? <Users /> : <Courses />}</div>
    </div>
  );
}
