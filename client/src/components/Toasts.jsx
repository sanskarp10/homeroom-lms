import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { CircleCheck, CircleAlert, Info, X } from 'lucide-react';
import clsx from 'clsx';
import { toastDismissed } from '../store/uiSlice.js';

const ICONS = { success: CircleCheck, error: CircleAlert, info: Info };

function Toast({ toast }) {
  const dispatch = useDispatch();
  useEffect(() => {
    const timer = setTimeout(() => dispatch(toastDismissed(toast.id)), toast.type === 'error' ? 6500 : 3500);
    return () => clearTimeout(timer);
  }, [dispatch, toast.id, toast.type]);
  const Icon = ICONS[toast.type] || Info;
  return (
    <div role={toast.type === 'error' ? 'alert' : 'status'} className="pointer-events-auto flex w-full max-w-sm animate-toast items-start gap-3 rounded-xl bg-board-900 px-4 py-3 text-sm text-white shadow-pop">
      <Icon className={clsx('mt-0.5 h-4 w-4 shrink-0', toast.type === 'success' ? 'text-pencil' : toast.type === 'error' ? 'text-[#FF9A8C]' : 'text-white/70')} />
      <p className="flex-1 leading-snug">{toast.message}</p>
      <button type="button" onClick={() => dispatch(toastDismissed(toast.id))} className="on-board -mr-1 rounded p-0.5 text-white/60 hover:text-white" aria-label="Dismiss"><X className="h-4 w-4" /></button>
    </div>
  );
}

export default function Toasts() {
  const toasts = useSelector((s) => s.ui.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6" aria-live="polite">
      {toasts.map((t) => <Toast key={t.id} toast={t} />)}
    </div>
  );
}
