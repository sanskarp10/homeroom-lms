import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { amount } from '../lib/format.js';

const short = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** Daily earnings as bars. Long ranges are grouped into weeks so bars stay readable. */
export default function RevenueChart({ series, currency }) {
  const [hover, setHover] = useState(null);
  const buckets = useMemo(() => {
    if (series.length <= 90) return series.map((d) => ({ ...d, label: short(d.date) }));
    const weeks = [];
    for (let i = 0; i < series.length; i += 7) {
      const chunk = series.slice(i, i + 7);
      weeks.push({
        date: chunk[0].date,
        label: `${short(chunk[0].date)} to ${short(chunk.at(-1).date)}`,
        net: chunk.reduce((s, d) => s + d.net, 0),
        gross: chunk.reduce((s, d) => s + d.gross, 0),
        sales: chunk.reduce((s, d) => s + d.sales, 0),
      });
    }
    return weeks;
  }, [series]);
  const max = Math.max(1, ...buckets.map((b) => b.net));
  // Round the axis up to a tidy number.
  const step = 10 ** Math.floor(Math.log10(max));
  const top = Math.ceil(max / step) * step;
  const active = hover != null ? buckets[hover] : null;

  return (
    <div>
      <div className="mb-3 flex h-10 items-end justify-between gap-4 text-sm" aria-live="polite">
        {active ? (
          <p><span className="font-semibold tabular">{amount(active.net, currency)}</span> <span className="text-ink-faint">earned from {active.sales} {active.sales === 1 ? 'sale' : 'sales'}, {active.label}</span></p>
        ) : <p className="text-ink-faint">Hover or focus a bar for the detail.</p>}
      </div>
      <div className="flex gap-3">
        <div className="flex h-52 w-12 shrink-0 flex-col justify-between text-right text-2xs tabular text-ink-faint" aria-hidden="true">
          <span>{amount(top, currency)}</span><span>{amount(top / 2, currency)}</span><span>{amount(0, currency)}</span>
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden="true">
            <span className="border-t border-line" /><span className="border-t border-dashed border-line" /><span className="border-t border-line-strong" />
          </div>
          <ul className="relative flex h-52 items-end gap-px sm:gap-[3px]" aria-label="Earnings over time">
            {buckets.map((b, i) => (
              <li key={b.date} className="flex h-full min-w-0 flex-1 items-end">
                <button type="button" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                  aria-label={`${b.label}: ${amount(b.net, currency)} from ${b.sales} sales`}
                  className="group flex h-full w-full items-end rounded-t-sm focus-visible:outline-offset-0">
                  <span className={clsx('block w-full rounded-t-[3px] transition-colors duration-75', b.net ? (hover === i ? 'bg-pencil' : 'bg-board') : 'bg-line')}
                    style={{ height: b.net ? `${Math.max(3, (b.net / top) * 100)}%` : '2px' }} />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-between text-2xs text-ink-faint" aria-hidden="true">
            <span>{short(buckets[0].date)}</span>
            <span>{short(buckets[Math.floor(buckets.length / 2)].date)}</span>
            <span>{short(series.at(-1).date)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
