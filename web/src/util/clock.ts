const dayTime = new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit', second: '2-digit' });
const full = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** "Tue 9:15:12 AM" for anything within a week, otherwise "Nov 3, 2026, 10:23 AM". */
export function stamp(iso: string): string {
  const d = new Date(iso);
  return Math.abs(d.getTime() - Date.now()) < 6 * 864e5 ? dayTime.format(d) : full.format(d);
}

export const longStamp = (iso: string) => full.format(new Date(iso));

/** Value for <input type="datetime-local"> in the user's local zone. */
export function toLocalInput(d: Date): string {
  const shifted = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

export function tomorrowAt(hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d;
}
