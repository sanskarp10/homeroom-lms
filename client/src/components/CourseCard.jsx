import { Link } from 'react-router-dom';
import { Users, Clock, BookOpen } from 'lucide-react';
import CourseCover from './CourseCover.jsx';
import { Skeleton } from './ui.jsx';
import { money, duration, plural, titleCase } from '../lib/format.js';
import { api } from '../store/api.js';
import { useDispatch } from 'react-redux';

export default function CourseCard({ course }) {
  const dispatch = useDispatch();
  // Warm the cache on hover/focus so the course page opens instantly.
  const prefetch = () => dispatch(api.util.prefetch('getCourse', course.slug, { ifOlderThan: 60 }));
  return (
    <Link to={`/courses/${course.slug}`} onMouseEnter={prefetch} onFocus={prefetch} className="group block rounded-lg focus-visible:outline-offset-4">
      <CourseCover course={course} className="transition-transform duration-150 ease-out group-hover:-translate-y-1" />
      <div className="px-0.5 pt-3.5">
        {course.thumbnailUrl && <h3 className="mb-1 line-clamp-2 font-display text-lg font-semibold leading-snug">{course.title}</h3>}
        <p className="line-clamp-2 text-sm leading-snug text-ink-soft">{course.subtitle}</p>
        <p className="mt-2 text-[13px] text-ink-faint">{course.instructor?.name}</p>
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <ul className="flex min-w-0 items-center gap-3 text-xs text-ink-faint">
            <li className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" aria-hidden="true" />{plural(course.lessonCount, 'lesson')}</li>
            {course.totalDuration > 0 && <li className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{duration(course.totalDuration)}</li>}
            <li className="hidden items-center gap-1 sm:flex"><Users className="h-3.5 w-3.5" aria-hidden="true" />{course.enrollmentCount.toLocaleString()}</li>
          </ul>
          <span className="shrink-0 text-[15px] font-bold tabular text-ink">{money(course.price)}</span>
        </div>
        <span className="sr-only">{titleCase(course.level)} level</span>
      </div>
    </Link>
  );
}

export function CourseCardSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-[16/10] rounded-cover" />
      <Skeleton className="mt-4 h-4 w-11/12" />
      <Skeleton className="mt-2 h-4 w-2/3" />
      <Skeleton className="mt-3 h-3 w-1/3" />
    </div>
  );
}
