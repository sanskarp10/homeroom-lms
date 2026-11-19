import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useLoginMutation } from '../store/api.js';
import { selectUser, signedIn } from '../store/authSlice.js';
import { ErrorNote, Field, Spinner } from '../components/ui.jsx';
import { errorMessage } from '../lib/format.js';

const DEMO = [
  { label: 'Student', email: 'sam@homeroom.test', note: 'Sam has one finished course, one in progress' },
  { label: 'Instructor', email: 'maya@homeroom.test', note: 'Maya teaches four courses and has sales' },
  { label: 'Admin', email: 'admin@homeroom.test', note: 'Manages users and courses' },
];
const DEMO_PASSWORD = 'homeroom123';

export const homeFor = (user) => (user.role === 'student' ? '/learning' : user.role === 'admin' ? '/admin' : '/teach');

export function AuthShell({ title, lead, children, footer }) {
  return (
    <div className="page grid gap-10 pt-10 lg:grid-cols-2 lg:gap-16 lg:pt-16">
      <div className="mx-auto w-full max-w-md lg:mx-0 lg:justify-self-end">
        <h1 className="text-4xl font-semibold">{title}</h1>
        {lead && <p className="mt-2 text-ink-soft">{lead}</p>}
        <div className="mt-8">{children}</div>
        {footer && <p className="mt-6 text-sm text-ink-soft">{footer}</p>}
      </div>
      <div className="mx-auto hidden w-full max-w-md lg:mx-0 lg:block">
        <div className="board rounded-panel px-8 py-9">
          <p className="font-display text-2xl font-medium leading-snug text-white">“I watched the lessons on the train and saved my questions for Thursday’s class. That rhythm is why I finished.”</p>
          <p className="mt-5 text-sm text-white/65">Aisha, completed SQL for analysts</p>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const user = useSelector(selectUser);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [login, { isLoading, error }] = useLoginMutation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [pending, setPending] = useState('');
  const from = location.state?.from;

  if (user && !isLoading) return <Navigate to={from?.pathname || homeFor(user)} replace />;

  const submit = async (credentials) => {
    try {
      const session = await login(credentials).unwrap();
      dispatch(signedIn(session));
      navigate(from ? `${from.pathname}${from.search || ''}` : homeFor(session.user), { replace: true });
    } catch { /* shown below */ } finally { setPending(''); }
  };

  return (
    <AuthShell title="Sign in" lead={location.state?.reason || 'Pick up where you left off.'} footer={<>New here? <Link to="/register" state={location.state} className="link">Create an account</Link></>}>
      <form onSubmit={(e) => { e.preventDefault(); submit(form); }} className="space-y-4" noValidate>
        <ErrorNote>{error && errorMessage(error)}</ErrorNote>
        <Field label="Email"><input className="field h-11" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Password"><input className="field h-11" type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        <button type="submit" className="btn-primary btn-lg w-full" disabled={isLoading}>{isLoading && !pending && <Spinner />}Sign in</button>
      </form>

      <div className="mt-8 rounded-panel border border-line bg-white p-4">
        <p className="text-sm font-semibold">Try a demo account</p>
        <p className="mt-0.5 text-xs text-ink-faint">These exist after the demo data is loaded. Password for all: {DEMO_PASSWORD}</p>
        <div className="mt-3 grid gap-2">
          {DEMO.map((d) => (
            <button key={d.email} type="button" disabled={isLoading} onClick={() => { setPending(d.email); submit({ email: d.email, password: DEMO_PASSWORD }); }}
              className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-left transition-colors duration-100 hover:border-board hover:bg-paper disabled:opacity-60">
              <span className="w-20 shrink-0 text-sm font-semibold">{d.label}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-ink-faint">{d.note}</span>
              {pending === d.email && <Spinner className="text-board" />}
            </button>
          ))}
        </div>
      </div>
    </AuthShell>
  );
}
