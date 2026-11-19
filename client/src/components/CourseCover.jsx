/**
 * Courses without an uploaded image get a generated cover that looks like a
 * cloth-bound textbook: one flat colour per subject, a spine, a small motif and
 * the title set in the display face.
 */
import clsx from 'clsx';
import { assetUrl } from '../lib/format.js';

const SUBJECTS = {
  'Web Development': { bg: '#1F3A33', motif: 'brackets' },
  'Data Science': { bg: '#20365C', motif: 'bars' },
  Design: { bg: '#7A2E3A', motif: 'shapes' },
  Business: { bg: '#3A3B37', motif: 'rise' },
  Photography: { bg: '#2F5D62', motif: 'aperture' },
  Music: { bg: '#5B3A6B', motif: 'staff' },
  Languages: { bg: '#8A5E00', motif: 'quotes' },
  'Personal Growth': { bg: '#4E6B3A', motif: 'rings' },
};
export const subjectColor = (category) => (SUBJECTS[category] || SUBJECTS['Web Development']).bg;

const Y = '#F2B632';
const W = 'rgba(255,255,255,.82)';
const MOTIFS = {
  brackets: <g fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 14 6 32l16 18" stroke={W} /><path d="M58 14l16 18-16 18" stroke={W} /><path d="M46 8 34 56" stroke={Y} /></g>,
  bars: <g><rect x="6" y="36" width="12" height="22" fill={W} /><rect x="24" y="22" width="12" height="36" fill={W} /><rect x="42" y="30" width="12" height="28" fill={W} /><rect x="60" y="8" width="12" height="50" fill={Y} /></g>,
  shapes: <g><rect x="6" y="20" width="38" height="38" fill={W} /><circle cx="52" cy="26" r="20" fill={Y} /></g>,
  rise: <g fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 54 28 34l14 10 30-32" stroke={W} /><path d="M54 12h18v18" stroke={Y} /></g>,
  aperture: <g fill="none" strokeWidth="5"><circle cx="40" cy="32" r="26" stroke={W} /><circle cx="40" cy="32" r="10" fill={Y} stroke="none" /></g>,
  staff: <g><g stroke={W} strokeWidth="2.5">{[12, 22, 32, 42, 52].map((y) => <path key={y} d={`M4 ${y}h72`} />)}</g><circle cx="24" cy="42" r="7" fill={Y} /><circle cx="52" cy="27" r="7" fill={Y} /><path d="M31 42V14M59 27V4" stroke={Y} strokeWidth="3" /></g>,
  quotes: <g><path d="M8 14h28v22a16 16 0 0 1-16 16v-10a6 6 0 0 0 6-6H8z" fill={W} /><path d="M44 14h28v22a16 16 0 0 1-16 16v-10a6 6 0 0 0 6-6H44z" fill={Y} /></g>,
  rings: <g fill="none" strokeWidth="5"><circle cx="40" cy="34" r="27" stroke={W} /><circle cx="40" cy="34" r="16" stroke={W} /><circle cx="40" cy="34" r="5" fill={Y} stroke="none" /></g>,
};

export default function CourseCover({ course, size = 'md', className, as: Title = 'h3' }) {
  const subject = SUBJECTS[course.category] || SUBJECTS['Web Development'];
  if (course.thumbnailUrl) {
    return (
      <div className={clsx('relative aspect-[16/10] overflow-hidden rounded-cover bg-chalk shadow-book', className)}>
        <img src={assetUrl(course.thumbnailUrl)} alt="" loading="lazy" className="h-full w-full object-cover" />
      </div>
    );
  }
  const big = size === 'lg';
  return (
    <div className={clsx('relative flex aspect-[16/10] flex-col justify-between overflow-hidden rounded-cover text-white shadow-book', className)} style={{ backgroundColor: subject.bg }}>
      {/* spine */}
      <div className="absolute inset-y-0 left-0 w-3 bg-black/20" aria-hidden="true" />
      <div className="absolute inset-y-0 left-3 w-px bg-white/15" aria-hidden="true" />
      <div className={clsx('flex items-start justify-between', big ? 'pl-10 pr-7 pt-7' : 'pl-7 pr-4 pt-4')}>
        <span className={clsx('font-semibold text-white/75', big ? 'text-sm' : 'text-2xs')}>{course.category}</span>
        <svg viewBox="0 0 80 64" className={clsx('shrink-0', big ? 'h-16 w-20' : 'h-10 w-12')} aria-hidden="true">{MOTIFS[subject.motif]}</svg>
      </div>
      <div className={big ? 'pb-7 pl-10 pr-7' : 'pb-4 pl-7 pr-4'}>
        <Title className={clsx('text-balance font-display font-semibold leading-[1.12] text-white', big ? 'text-3xl sm:text-4xl' : 'line-clamp-3 text-[1.2rem]')}>{course.title}</Title>
        <div className={clsx('mt-2.5 h-[3px] rounded-full bg-pencil', big ? 'w-16' : 'w-9')} aria-hidden="true" />
      </div>
    </div>
  );
}
