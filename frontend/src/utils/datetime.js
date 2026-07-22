/**
 * Safely parse a timestamp from the database.
 * DB may return timestamps without timezone suffix (e.g. "2026-07-21 04:37:47").
 * Browsers interpret those as local time instead of UTC.
 * This function appends 'Z' to force UTC interpretation when no timezone marker is present.
 */
export function parseTimestamp(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  const str = String(val);
  const hasTimezone = /[Zz]|[+-]\d{2}:\d{2}$/.test(str);
  const utcStr = hasTimezone ? str : str.replace(' ', 'T') + 'Z';
  const d = new Date(utcStr);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Format a timestamp to locale date+time string.
 * Returns '—' if the value is null/invalid.
 */
export function formatDateTime(val) {
  const d = parseTimestamp(val);
  if (!d) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
}

/**
 * Format a timestamp to locale time-only string.
 * Returns '—' if the value is null/invalid.
 */
export function formatTime(val) {
  const d = parseTimestamp(val);
  if (!d) return '—';
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mi}:${ss}`;
}
