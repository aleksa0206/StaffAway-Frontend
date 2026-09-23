import { Holiday, LeaveRequest } from '../../core/api/models';
import { addDays, daysBetween, isWeekend, parseIsoDate, rangesOverlap } from '../util/dates';

export interface CalendarDay {
  iso: string;
  dayOfMonth: number;
  weekday: string;
  isWeekend: boolean;
  isToday: boolean;
  holiday: string | null;
}

export interface AbsenceBar {
  request: LeaveRequest;
  /** Column index of the first visible day. */
  start: number;
  /** Number of visible days. */
  span: number;
  /** The absence continues before / after the visible range. */
  continuesBefore: boolean;
  continuesAfter: boolean;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function holidayName(iso: string, holidays: readonly Holiday[]): string | null {
  const match = holidays.find((h) =>
    h.isRecurring ? h.date.slice(5, 10) === iso.slice(5) : h.date.slice(0, 10) === iso,
  );
  return match?.name ?? null;
}

export function buildDays(
  from: string,
  to: string,
  holidays: readonly Holiday[],
  today: string,
): CalendarDay[] {
  const days: CalendarDay[] = [];
  for (let iso = from; iso <= to; iso = addDays(iso, 1)) {
    const date = parseIsoDate(iso);
    days.push({
      iso,
      dayOfMonth: date.getUTCDate(),
      weekday: WEEKDAYS[date.getUTCDay()]!,
      isWeekend: isWeekend(iso),
      isToday: iso === today,
      holiday: holidayName(iso, holidays),
    });
  }
  return days;
}

/** Bars per user for the visible days, clipped to the range. */
export function layoutBars(
  requests: readonly LeaveRequest[],
  days: readonly CalendarDay[],
): Map<number, AbsenceBar[]> {
  const bars = new Map<number, AbsenceBar[]>();
  const first = days[0]?.iso;
  const last = days[days.length - 1]?.iso;
  if (!first || !last) return bars;

  for (const request of requests) {
    const start = request.startDate.slice(0, 10);
    const end = request.endDate.slice(0, 10);
    if (!rangesOverlap(start, end, first, last)) continue;
    const visibleStart = start < first ? first : start;
    const visibleEnd = end > last ? last : end;
    const bar: AbsenceBar = {
      request,
      start: daysBetween(first, visibleStart),
      span: daysBetween(visibleStart, visibleEnd) + 1,
      continuesBefore: start < first,
      continuesAfter: end > last,
    };
    bars.set(request.userId, [...(bars.get(request.userId) ?? []), bar]);
  }
  return bars;
}

/** How many different people are away on each visible working day (0 on weekends/holidays). */
export function awayCounts(
  requests: readonly LeaveRequest[],
  days: readonly CalendarDay[],
): number[] {
  return days.map((day) => {
    if (day.isWeekend || day.holiday) return 0;
    const people = new Set(
      requests
        .filter((r) => rangesOverlap(r.startDate, r.endDate, day.iso, day.iso))
        .map((r) => r.userId),
    );
    return people.size;
  });
}

/** Other people's requests that overlap the given period (used for "who else is away"). */
export function overlappingRequests(
  requests: readonly LeaveRequest[],
  period: { userId: number; startDate: string; endDate: string },
): LeaveRequest[] {
  return requests.filter(
    (r) =>
      r.userId !== period.userId &&
      rangesOverlap(r.startDate, r.endDate, period.startDate, period.endDate),
  );
}
