import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useUpdateProfileMutation, useChangePasswordMutation, useGetOrdersQuery } from '../store/api.js';
import { selectUser, userUpdated } from '../store/authSlice.js';
import { toast } from '../store/uiSlice.js';
import { Avatar, ErrorNote, Field, Spinner, StatusTag } from '../components/ui.jsx';
import { amount, dateLabel, errorMessage } from '../lib/format.js';

export default function Account() {
  const user = useSelector(selectUser);
  const dispatch = useDispatch();
  const [updateProfile, profileState] = useUpdateProfileMutation();
  const [changePassword, passwordState] = useChangePasswordMutation();
  const orders = useGetOrdersQuery();
  const [profile, setProfile] = useState({ name: user.name, headline: user.headline || '', bio: user.bio || '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });

  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      const { user: updated } = await updateProfile(profile).unwrap();
      dispatch(userUpdated(updated));
      dispatch(toast.success('Profile saved.'));
    } catch { /* shown inline */ }
  };
  const savePassword = async (e) => {
    e.preventDefault();
    try {
      await changePassword(passwords).unwrap();
      setPasswords({ currentPassword: '', newPassword: '' });
      dispatch(toast.success('Password changed.'));
    } catch { /* shown inline */ }
  };

  return (
    <div className="page max-w-3xl pt-10">
      <div className="flex items-center gap-4">
        <Avatar name={user.name} size={64} />
        <div>
          <h1 className="text-4xl font-semibold">Account</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-ink-faint">{user.email}<StatusTag status={user.role} /></p>
        </div>
      </div>

      <form onSubmit={saveProfile} className="panel mt-8 space-y-4 p-6">
        <h2 className="text-xl font-semibold">Profile</h2>
        <ErrorNote>{profileState.error && errorMessage(profileState.error)}</ErrorNote>
        <Field label="Full name" hint="Printed on certificates issued from now on."><input className="field" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required /></Field>
        <Field label="Headline" hint={user.role === 'student' ? 'Optional.' : 'Shown next to your name on course pages.'}><input className="field" maxLength={140} value={profile.headline} onChange={(e) => setProfile({ ...profile, headline: e.target.value })} /></Field>
        {user.role !== 'student' && <Field label="About you"><textarea className="field min-h-28" maxLength={2000} value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} /></Field>}
        <button type="submit" className="btn-primary" disabled={profileState.isLoading}>{profileState.isLoading && <Spinner />}Save profile</button>
      </form>

      <form onSubmit={savePassword} className="panel mt-6 space-y-4 p-6">
        <h2 className="text-xl font-semibold">Password</h2>
        <ErrorNote>{passwordState.error && errorMessage(passwordState.error)}</ErrorNote>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Current password"><input className="field" type="password" autoComplete="current-password" value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} required /></Field>
          <Field label="New password" hint="At least 8 characters."><input className="field" type="password" autoComplete="new-password" minLength={8} value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} required /></Field>
        </div>
        <button type="submit" className="btn-primary" disabled={passwordState.isLoading}>{passwordState.isLoading && <Spinner />}Change password</button>
      </form>

      <section id="purchases" className="panel mt-6 scroll-mt-24 p-6">
        <h2 className="text-xl font-semibold">Purchases</h2>
        {orders.data?.items.length ? (
          <ul className="mt-3 divide-y divide-line">
            {orders.data.items.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <div className="min-w-0">
                  {o.course ? <Link to={`/courses/${o.course.slug}`} className="font-semibold hover:underline">{o.course.title}</Link> : <span className="font-semibold">Removed course</span>}
                  <p className="text-xs text-ink-faint">{dateLabel(o.paidAt)}, {o.provider === 'stripe' ? 'paid with Stripe' : 'test payment'}</p>
                </div>
                <span className="shrink-0 font-semibold tabular">{amount(o.amount, o.currency)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-sm text-ink-faint">{orders.isLoading ? 'Loading purchases' : 'You have not bought a course yet. Free enrollments are not listed here.'}</p>}
      </section>
    </div>
  );
}
