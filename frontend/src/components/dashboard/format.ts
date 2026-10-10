/** Parse a `YYYY-MM-DD` date as a local calendar date (avoids UTC off-by-one). */
const parseDateOnly = (value: string): Date => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

const startOfToday = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const DAY_MS = 86_400_000;

/** "Due today", "Due tomorrow", "Due in 3 days", "2 days overdue", "Due Mar 4". */
export const formatDueDate = (value: string | null): string => {
  if (!value) return 'No due date';
  const due = parseDateOnly(value);
  const diff = Math.round((due.getTime() - startOfToday().getTime()) / DAY_MS);
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  if (diff === -1) return '1 day overdue';
  if (diff < 0) return `${Math.abs(diff)} days overdue`;
  if (diff < 7) return `Due in ${diff} days`;
  return `Due ${due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
};

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

const UNITS: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
  { unit: 'year', seconds: 31_536_000 },
  { unit: 'month', seconds: 2_592_000 },
  { unit: 'week', seconds: 604_800 },
  { unit: 'day', seconds: 86_400 },
  { unit: 'hour', seconds: 3_600 },
  { unit: 'minute', seconds: 60 },
];

/** "5 minutes ago", "yesterday", "just now". */
export const formatRelativeTime = (iso: string): string => {
  const elapsed = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const { unit, seconds } of UNITS) {
    if (Math.abs(elapsed) >= seconds) {
      return relativeFormatter.format(Math.round(elapsed / seconds), unit);
    }
  }
  return 'just now';
};
