import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import clsx from 'clsx';
import { GraduationCap, Presentation } from 'lucide-react';
import { useRegisterMutation } from '../store/api.js';
import { selectUser, signedIn } from '../store/authSlice.js';
import { toast } from '../store/uiSlice.js';
import { ErrorNote, Field, Spinner } from '../components/ui.jsx';
import { errorMessage } from '../lib/format.js';
import { AuthShell, homeFor } from './Login.jsx';

const ROLES = [
  { value: 'student', label: 'I want to learn', icon: GraduationCap, note: 'Take courses and join live classes' },
  { value: 'instructor', label: 'I want to teach', icon: Presentation, note: 'Publish courses and earn from sales' },
];

export default function Register() {
  const user = useSelector(selectUser);
  const [params] = useSearchParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [register, { isLoading, error }] = useRegisterMutation();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: params.get('role') === 'instructor' ? 'instructor' : 'student' });
  const from = location.state?.from;
  const fieldError = (name) => error?.data?.details?.find((d) => d.field === name)?.message;

  if (user && !isLoading) return <Navigate to={homeFor(user)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    try {
      const session = await register(form).unwrap();
      dispatch(signedIn(session));
      dispatch(toast.success(`Welcome to Homeroom, ${session.user.name.split(' ')[0]}.`));
      navigate(from && session.user.role === 'student' ? from.pathname : session.user.role === 'student' ? '/courses' : '/teach', { replace: true });
    } catch { /* shown below */ }
  };
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <AuthShell title="Create your account" lead="Free to join. Pay only for the courses you choose." footer={<>Already have an account? <Link to="/login" state={location.state} className="link">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <ErrorNote>{error && !error.data?.details && errorMessage(error)}</ErrorNote>
        <fieldset>
          <legend className="label">What brings you here?</legend>
          <div className="grid grid-cols-2 gap-2.5">
            {ROLES.map((r) => (
              <label key={r.value} className={clsx('cursor-pointer rounded-xl border p-3.5 transition-colors duration-100', form.role === r.value ? 'border-board bg-white ring-2 ring-board/15' : 'border-line-strong bg-white/60 hover:border-board')}>
                <input type="radio" name="role" value={r.value} checked={form.role === r.value} onChange={set('role')} className="sr-only" />
                <r.icon className={clsx('h-5 w-5', form.role === r.value ? 'text-board' : 'text-ink-faint')} aria-hidden="true" />
                <span className="mt-2 block text-sm font-semibold">{r.label}</span>
                <span className="mt-0.5 block text-xs leading-snug text-ink-faint">{r.note}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Full name" error={fieldError('name')} hint="This is the name printed on your certificates."><input className="field h-11" autoComplete="name" required value={form.name} onChange={set('name')} /></Field>
        <Field label="Email" error={fieldError('email')}><input className="field h-11" type="email" autoComplete="email" required value={form.email} onChange={set('email')} /></Field>
        <Field label="Password" error={fieldError('password')} hint="At least 8 characters."><input className="field h-11" type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={set('password')} /></Field>
        <button type="submit" className="btn-primary btn-lg w-full" disabled={isLoading}>{isLoading && <Spinner />}Create account</button>
      </form>
    </AuthShell>
  );
}
