import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { Search, SearchX, ChevronLeft, ChevronRight } from 'lucide-react';
import { useGetCoursesQuery, useGetCategoriesQuery } from '../store/api.js';
import CourseCard, { CourseCardSkeleton } from '../components/CourseCard.jsx';
import { Empty, Segmented } from '../components/ui.jsx';
import { plural, titleCase } from '../lib/format.js';

export default function Catalog() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const category = params.get('category') || '';
  const level = params.get('level') || '';
  const price = params.get('price') || '';
  const sort = params.get('sort') || 'popular';
  const page = Number(params.get('page')) || 1;

  const [text, setText] = useState(q);
  useEffect(() => setText(q), [q]);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries({ page: '', ...changes }).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  // Search as you type, but only hit the server once typing pauses.
  useEffect(() => {
    if (text === q) return undefined;
    const timer = setTimeout(() => update({ q: text.trim() }), 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const query = { sort, page, limit: 12, ...(q && { q }), ...(category && { category }), ...(level && { level }), ...(price && { price }) };
  const { data, isLoading, isFetching, isError } = useGetCoursesQuery(query);
  const categories = useGetCategoriesQuery();
  const filtered = q || category || level || price;

  const pill = (active) => clsx('h-9 shrink-0 rounded-full border px-3.5 text-sm font-semibold transition-colors duration-100',
    active ? 'border-board bg-board text-white' : 'border-line-strong bg-white text-ink-soft hover:border-board hover:text-ink');

  return (
    <div className="page pt-10">
      <h1 className="text-4xl font-semibold sm:text-5xl">Courses</h1>

      <div className="mt-7 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative block flex-1">
          <span className="sr-only">Search courses</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
          <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search by title or topic" className="field h-11 pl-10 text-[15px]" />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Segmented label="Price" value={price} onChange={(v) => update({ price: v })} options={[{ value: '', label: 'Any price' }, { value: 'free', label: 'Free' }, { value: 'paid', label: 'Paid' }]} />
          <select aria-label="Level" value={level} onChange={(e) => update({ level: e.target.value })} className="field h-10 w-auto pr-8">
            <option value="">All levels</option>
            {(categories.data?.levels || []).map((l) => <option key={l} value={l}>{titleCase(l)}</option>)}
          </select>
          <select aria-label="Sort" value={sort} onChange={(e) => update({ sort: e.target.value === 'popular' ? '' : e.target.value })} className="field h-10 w-auto pr-8">
            <option value="popular">Most enrolled</option>
            <option value="newest">Newest</option>
            <option value="price-asc">Price, low to high</option>
            <option value="price-desc">Price, high to low</option>
          </select>
        </div>
      </div>

      <div className="scroll-thin -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Subject">
        <button type="button" className={pill(!category)} onClick={() => update({ category: '' })}>All subjects</button>
        {(categories.data?.categories || []).filter((c) => c.count > 0).map((c) => (
          <button key={c.name} type="button" className={pill(category === c.name)} aria-pressed={category === c.name} onClick={() => update({ category: category === c.name ? '' : c.name })}>{c.name}</button>
        ))}
      </div>

      <p className="mt-6 text-sm text-ink-faint" aria-live="polite">
        {isLoading ? 'Loading courses' : data ? `${plural(data.total, 'course')}${q ? ` for "${q}"` : ''}` : ''}
      </p>

      <div className={clsx('mt-5 grid gap-x-6 gap-y-10 transition-opacity duration-150 sm:grid-cols-2 lg:grid-cols-4', isFetching && !isLoading && 'opacity-60')}>
        {isLoading ? Array.from({ length: 8 }, (_, i) => <CourseCardSkeleton key={i} />) : data?.items.map((c) => <CourseCard key={c.id} course={c} />)}
      </div>

      {isError && <Empty icon={SearchX} title="The catalog could not be loaded">Check that the API is running, then reload this page.</Empty>}
      {data && data.items.length === 0 && (
        <Empty icon={SearchX} title="No courses match these filters" action={filtered && <button type="button" className="btn-outline" onClick={() => setParams({}, { replace: true })}>Clear filters</button>}>
          Try a broader search term or a different subject.
        </Empty>
      )}

      {data && data.pages > 1 && (
        <nav className="mt-12 flex items-center justify-center gap-3" aria-label="Pages">
          <button type="button" className="btn-outline btn-icon" disabled={page <= 1} onClick={() => update({ page: page > 2 ? String(page - 1) : '' })} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-sm tabular text-ink-soft">Page {data.page} of {data.pages}</span>
          <button type="button" className="btn-outline btn-icon" disabled={page >= data.pages} onClick={() => update({ page: String(page + 1) })} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
        </nav>
      )}
    </div>
  );
}
