// Leave dates are calendar dates (`YYYY-MM-DD`, stored by the backend as UTC midnight), so all
// arithmetic here is done in UTC to stay independent of the user's time zone.

const DAY_MS = 24 * 60 * 60 * 1000;

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseIsoDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

/** Today's calendar date in the user's time zone, as `YYYY-MM-DD`. */
export function todayIso(now = new Date()): string {
  return isoDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

export function addDays(value: string, days: number): string {
  return isoDate(new Date(parseIsoDate(value).getTime() + days * DAY_MS));
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / DAY_MS);
}

export function isWeekend(value: string): boolean {
  const day = parseIsoDate(value).getUTCDay();
  return day === 0 || day === 6;
}

/** `YYYY-MM` → first and last day of that month. */
export function monthRange(month: string): { from: string; to: string } {
  const [year, monthIndex] = month.split('-').map(Number) as [number, number];
  const from = isoDate(new Date(Date.UTC(year, monthIndex - 1, 1)));
  const to = isoDate(new Date(Date.UTC(year, monthIndex, 0)));
  return { from, to };
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthIndex] = month.split('-').map(Number) as [number, number];
  return isoDate(new Date(Date.UTC(year, monthIndex - 1 + delta, 1))).slice(0, 7);
}

/** Monday of the week containing `value`. */
export function startOfWeek(value: string): string {
  const day = parseIsoDate(value).getUTCDay();
  return addDays(value, day === 0 ? -6 : 1 - day);
}

/** Inclusive date ranges overlap. */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart.slice(0, 10) <= bEnd.slice(0, 10) && bStart.slice(0, 10) <= aEnd.slice(0, 10);
}
