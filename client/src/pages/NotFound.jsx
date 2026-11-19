import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="page grid min-h-[55vh] place-items-center pt-10 text-center">
      <div>
        <p className="font-display text-7xl font-semibold text-board">404</p>
        <h1 className="mt-3 text-3xl font-semibold">This page is not on the timetable</h1>
        <p className="mx-auto mt-2 max-w-md text-ink-soft">The link may be old or mistyped. The course list is a good place to start again.</p>
        <Link to="/courses" className="btn-primary mt-6">Browse courses</Link>
      </div>
    </div>
  );
}
