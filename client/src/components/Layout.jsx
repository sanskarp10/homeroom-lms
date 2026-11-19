import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import clsx from 'clsx';
import { Menu, X, LogOut, Award, UserRound, GraduationCap, ChartNoAxesColumn, ShieldCheck, ChevronDown, Receipt } from 'lucide-react';
import { selectUser, signedOut } from '../store/authSlice.js';
import { toast } from '../store/uiSlice.js';
import { Avatar } from './ui.jsx';

export function Logo({ light = false, className }) {
  return (
    <Link to="/" className={clsx('inline-flex items-center gap-2 rounded-md', className)} aria-label="Homeroom home">
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill={light ? '#fff' : '#1F3A33'} />
        <path d="M9 8v16M23 8v16M9 16h14" stroke={light ? '#1F3A33' : '#fff'} strokeWidth="3" strokeLinecap="round" />
        <rect x="7" y="25" width="18" height="2.5" rx="1.25" fill="#F2B632" />
      </svg>
      <span className={clsx('font-display text-[1.3rem] font-semibold tracking-tight', light ? 'text-white' : 'text-ink')}>Homeroom</span>
    </Link>
  );
}

function navFor(user) {
  const items = [{ to: '/courses', label: 'Courses' }, { to: '/live', label: 'Live classes' }];
  if (user?.role === 'student') items.push({ to: '/learning', label: 'My learning' });
  if (user?.role === 'instructor' || user?.role === 'admin') items.push({ to: '/teach', label: 'Teach' });
  if (user?.role === 'admin') items.push({ to: '/admin', label: 'Admin' });
  return items;
}

function UserMenu({ user }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const key = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', key); };
  }, [open]);

  const signOut = () => {
    dispatch(signedOut());
    dispatch(toast.info('Signed out.'));
    navigate('/');
  };
  const item = 'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-ink-soft hover:bg-chalk hover:text-ink';
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 hover:bg-board/5">
        <Avatar name={user.name} size={32} />
        <ChevronDown className={clsx('h-4 w-4 text-ink-faint transition-transform duration-100', open && 'rotate-180')} />
        <span className="sr-only">Account menu for {user.name}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-[calc(100%+8px)] z-40 w-64 origin-top-right animate-pop rounded-xl border border-line bg-white p-1.5 shadow-pop">
          <div className="border-b border-line px-2.5 pb-2.5 pt-1.5">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-ink-faint">{user.email}</p>
          </div>
          <div className="pt-1.5">
            {user.role === 'student' && <Link role="menuitem" to="/learning" className={item}><GraduationCap className="h-4 w-4" />My learning</Link>}
            {user.role !== 'student' && <Link role="menuitem" to="/teach" className={item}><ChartNoAxesColumn className="h-4 w-4" />Earnings and courses</Link>}
            {user.role === 'admin' && <Link role="menuitem" to="/admin" className={item}><ShieldCheck className="h-4 w-4" />Admin</Link>}
            <Link role="menuitem" to="/certificates" className={item}><Award className="h-4 w-4" />Certificates</Link>
            <Link role="menuitem" to="/account" className={item}><UserRound className="h-4 w-4" />Account</Link>
            <Link role="menuitem" to="/account#purchases" className={item}><Receipt className="h-4 w-4" />Purchases</Link>
            <button role="menuitem" type="button" onClick={signOut} className={clsx(item, 'mt-1 border-t border-line pt-2.5')}><LogOut className="h-4 w-4" />Sign out</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const user = useSelector(selectUser);
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  useEffect(() => setMenu(false), [location.pathname]);
  const items = navFor(user);
  const link = ({ isActive }) => clsx('relative rounded-md px-3 py-2 text-sm font-semibold transition-colors duration-100', isActive ? 'text-ink' : 'text-ink-faint hover:text-ink');
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur-md">
      <div className="page flex h-16 items-center gap-4">
        <Logo />
        <nav className="ml-4 hidden items-center md:flex" aria-label="Main">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} className={link}>
              {({ isActive }) => (<>{i.label}{isActive && <span className="absolute inset-x-3 -bottom-[13px] h-[3px] rounded-full bg-pencil" aria-hidden="true" />}</>)}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user ? <UserMenu user={user} /> : (
            <>
              <Link to="/login" state={{ from: location }} className="btn-ghost hidden sm:inline-flex">Sign in</Link>
              <Link to="/register" className="btn-primary">Join free</Link>
            </>
          )}
          <button type="button" className="btn-ghost btn-icon md:hidden" onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-label="Menu">
            {menu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {menu && (
        <nav className="page animate-fade border-t border-line pb-3 pt-2 md:hidden" aria-label="Mobile">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} className={({ isActive }) => clsx('block rounded-md px-3 py-2.5 text-[15px] font-semibold', isActive ? 'bg-board/5 text-ink' : 'text-ink-soft')}>{i.label}</NavLink>
          ))}
          {!user && <NavLink to="/login" className="block rounded-md px-3 py-2.5 text-[15px] font-semibold text-ink-soft">Sign in</NavLink>}
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="page flex flex-col gap-6 py-10 text-sm text-ink-faint sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Logo />
          <p className="mt-2 max-w-sm">An online school with recorded lessons, live classes, quizzes and certificates.</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Footer">
          <Link to="/courses" className="hover:text-ink">Courses</Link>
          <Link to="/live" className="hover:text-ink">Live classes</Link>
          <Link to="/verify" className="hover:text-ink">Verify a certificate</Link>
          <Link to="/register?role=instructor" className="hover:text-ink">Teach on Homeroom</Link>
        </nav>
      </div>
    </footer>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-board focus:px-3 focus:py-2 focus:text-white">Skip to content</a>
      <Header />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
