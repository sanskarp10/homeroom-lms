import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { X, LoaderCircle } from 'lucide-react';
import { initials } from '../lib/format.js';

export function Spinner({ className }) {
  return <LoaderCircle className={clsx('h-4 w-4 animate-spin', className)} aria-hidden="true" />;
}

export function PageLoader({ label = 'Loading' }) {
  return (
    <div className="grid min-h-[40vh] place-items-center" role="status" aria-label={label}>
      <Spinner className="h-6 w-6 text-board" />
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={clsx('skeleton', className)} aria-hidden="true" />;
}

/** Pencil-yellow progress on a ruled track. */
export function ProgressBar({ value = 0, className, tone = 'pencil', label }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={clsx('h-1.5 w-full overflow-hidden rounded-full bg-board/10', className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label || 'Progress'}>
      <div className={clsx('h-full rounded-full transition-[width] duration-300 ease-out', tone === 'pencil' ? 'bg-pencil' : tone === 'pass' ? 'bg-pass' : 'bg-board')} style={{ width: `${pct}%` }} />
    </div>
  );
}

const AVATAR_TONES = ['bg-board text-white', 'bg-pencil text-ink', 'bg-[#20365C] text-white', 'bg-[#7A2E3A] text-white', 'bg-[#2F5D62] text-white', 'bg-[#5B3A6B] text-white'];
export function Avatar({ name = '', size = 36, className }) {
  const tone = AVATAR_TONES[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_TONES.length];
  return (
    <span className={clsx('inline-grid shrink-0 select-none place-items-center rounded-full font-semibold', tone, className)} style={{ width: size, height: size, fontSize: Math.max(11, size * 0.38) }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

const STATUS_STYLES = {
  published: 'bg-pass-light text-pass',
  draft: 'bg-chalk text-ink-soft',
  archived: 'bg-redpen-light text-redpen',
  live: 'bg-redpen text-white',
  scheduled: 'bg-pencil-light text-pencil-deep',
  ended: 'bg-chalk text-ink-faint',
  paid: 'bg-pass-light text-pass',
  student: 'bg-chalk text-ink-soft',
  instructor: 'bg-pencil-light text-pencil-deep',
  admin: 'bg-board text-white',
  host: 'bg-pencil text-ink',
};
export function StatusTag({ status, children, className }) {
  return (
    <span className={clsx('tag', STATUS_STYLES[status] || 'bg-chalk text-ink-soft', className)}>
      {status === 'live' && <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-white" />}
      {children || status?.charAt(0).toUpperCase() + status?.slice(1)}
    </span>
  );
}

export function Empty({ icon: Icon, title, children, action }) {
  return (
    <div className="grid place-items-center rounded-panel border border-dashed border-line-strong bg-white/60 px-6 py-14 text-center">
      {Icon && <Icon className="mb-3 h-7 w-7 text-board-500" strokeWidth={1.6} aria-hidden="true" />}
      <h3 className="text-lg font-semibold">{title}</h3>
      {children && <p className="mt-1.5 max-w-md text-sm text-ink-faint">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorNote({ children, className }) {
  if (!children) return null;
  return <div role="alert" className={clsx('rounded-lg border border-redpen/25 bg-redpen-light px-3.5 py-2.5 text-sm text-redpen', className)}>{children}</div>;
}

export function Field({ label, hint, error, children, className }) {
  return (
    <label className={clsx('block', className)}>
      {label && <span className="label">{label}</span>}
      {children}
      {error ? <span className="mt-1.5 block text-xs font-medium text-redpen">{error}</span> : hint ? <span className="hint block">{hint}</span> : null}
    </label>
  );
}

/** Segmented control for small sets of options. */
export function Segmented({ value, onChange, options, className, size = 'md', label }) {
  return (
    <div role="tablist" aria-label={label} className={clsx('inline-flex rounded-lg bg-board/[.07] p-1', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button key={o.value} type="button" role="tab" aria-selected={active} onClick={() => onChange(o.value)}
            className={clsx('rounded-md font-semibold transition-colors duration-100', size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3.5 text-[13px]',
              active ? 'bg-white text-ink shadow-sm' : 'text-ink-faint hover:text-ink')}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, width = 'max-w-lg' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector('input, textarea, select, button:not([data-close])')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-end overflow-y-auto sm:place-items-center sm:p-6">
      <div className="fixed inset-0 animate-fade bg-board-950/55" onClick={onClose} aria-hidden="true" />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={clsx('relative w-full animate-pop rounded-t-panel bg-white shadow-pop sm:rounded-panel', width)}>
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" data-close onClick={onClose} className="btn-ghost btn-icon -mr-2" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-paper/60 px-5 py-3.5 sm:rounded-b-panel">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function Confirm({ open, onClose, onConfirm, title, children, confirmLabel = 'Delete', busy, tone = 'danger' }) {
  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-md"
      footer={<>
        <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
        <button type="button" className={tone === 'danger' ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={busy}>{busy && <Spinner />}{confirmLabel}</button>
      </>}>
      <p className="text-sm leading-relaxed text-ink-soft">{children}</p>
    </Modal>
  );
}
