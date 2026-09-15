import { Holiday } from '../../core/api/models';

const DAY_MS = 24 * 60 * 60 * 1000;

function parseUtcDate(value: string): number {
  return Date.parse(`${value.slice(0, 10)}T00:00:00Z`);
}

function isHoliday(day: Date, holidays: Holiday[]): boolean {
  const iso = day.toISOString().slice(0, 10);
  const monthDay = iso.slice(5);
  return holidays.some((holiday) =>
    holiday.isRecurring
      ? holiday.date.slice(5, 10) === monthDay
      : holiday.date.slice(0, 10) === iso,
  );
}

/**
 * Number of working days (excluding Saturdays, Sundays and company holidays) between two dates,
 * inclusive. The backend only checks that `totalDays` does not exceed the date span; this is the
 * value the form sends as `totalDays`. Returns 0 for an invalid or reversed range.
 */
export function countWorkingDays(start: string, end: string, holidays: Holiday[]): number {
  const from = parseUtcDate(start);
  const to = parseUtcDate(end);
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) {
    return 0;
  }
  let count = 0;
  for (let time = from; time <= to; time += DAY_MS) {
    const day = new Date(time);
    const weekday = day.getUTCDay();
    if (weekday !== 0 && weekday !== 6 && !isHoliday(day, holidays)) {
      count++;
    }
  }
  return count;
}
