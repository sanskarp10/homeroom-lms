export function money(cents, currency = 'usd', { free = 'Free' } = {}) {
  if (!cents) return free;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase(), minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
}
export const amount = (cents, currency = 'usd') => money(cents, currency, { free: money(1, currency).replace(/[\d.,]+/, '0') });

/** 5400 -> "1h 30m", 300 -> "5 min", 40 -> "40 sec" */
export function duration(seconds = 0) {
  const s = Math.round(seconds);
  if (s < 60) return `${s} sec`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}

/** 75 -> "1:15" */
export function clock(seconds = 0) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

const DAY = 86400000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function dayLabel(date) {
  const d = new Date(date);
  const diff = Math.round((startOfDay(d) - startOfDay(new Date())) / DAY);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
export const timeLabel = (date) => new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
export const dateLabel = (date) => new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

/** "in 2 hours", "in 3 days", "5 minutes ago" */
export function fromNow(date) {
  const ms = new Date(date).getTime() - Date.now();
  const abs = Math.abs(ms);
  const fmt = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (abs < 60000) return ms >= 0 ? 'in a moment' : 'just now';
  if (abs < 3600000) return fmt.format(Math.round(ms / 60000), 'minute');
  if (abs < DAY) return fmt.format(Math.round(ms / 3600000), 'hour');
  return fmt.format(Math.round(ms / DAY), 'day');
}

export const plural = (n, one, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
export const titleCase = (s = '') => s.charAt(0).toUpperCase() + s.slice(1);

/** Pull a readable message out of an RTK Query error. */
export function errorMessage(err, fallback = 'Something went wrong. Try again.') {
  if (!err) return fallback;
  if (err.status === 'FETCH_ERROR') return 'Cannot reach the server. Check that the API is running, then try again.';
  return err.data?.error || err.error || err.message || fallback;
}

/** Absolute URL for media/API paths when the API lives on another origin. */
export const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
export const assetUrl = (path) => (!path ? '' : /^https?:\/\//.test(path) ? path : `${API_ORIGIN}${path}`);
