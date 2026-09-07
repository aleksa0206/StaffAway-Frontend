import { DatePipe, formatDate } from '@angular/common';
import { inject, Pipe, PipeTransform } from '@angular/core';
import { IsoDateString, PersonRef } from '../../core/api/models';

// All date text goes through Angular's formatDate with one locale, so every screen spells
// months the same way ("28 Sep 2026").
const LOCALE = 'en-US';

/** Formats a UTC calendar date (e.g. 'MMMM y', 'd MMMM'). */
export function formatCalendar(value: IsoDateString, pattern: string): string {
  return formatDate(value, pattern, LOCALE, 'UTC');
}

/** Formats a point in time in the user's local time zone. */
export function formatLocal(value: Date | IsoDateString, pattern: string): string {
  return formatDate(value, pattern, LOCALE);
}

/**
 * Calendar date (leave, holiday, hire date) as "28 Dec 2026". The backend stores these as UTC
 * midnight, so they are shown in UTC; otherwise users west of Greenwich would see the day before.
 */
export function calendarDateText(value: IsoDateString): string {
  return formatCalendar(value, 'd MMM y');
}

@Pipe({ name: 'calendarDate' })
export class CalendarDatePipe implements PipeTransform {
  transform(value: IsoDateString | null | undefined): string {
    return value ? calendarDateText(value) : '';
  }
}

/** `YYYY-MM` → "June 2027". */
export function monthLabel(month: string): string {
  return formatCalendar(`${month}-01T00:00:00.000Z`, 'MMMM y');
}

/** Compact range for lists: "8–12 Jun 2027", "30 Jun – 2 Jul 2027". */
export function dateRangeText(start: IsoDateString, end: IsoDateString): string {
  const s = new Date(start);
  const e = new Date(end);
  if (start.slice(0, 10) === end.slice(0, 10)) return calendarDateText(start);
  const sameMonth =
    s.getUTCFullYear() === e.getUTCFullYear() && s.getUTCMonth() === e.getUTCMonth();
  if (sameMonth) return `${s.getUTCDate()}–${calendarDateText(end)}`;
  const sameYear = s.getUTCFullYear() === e.getUTCFullYear();
  const startText = sameYear
    ? calendarDateText(start).replace(/ \d{4}$/, '')
    : calendarDateText(start);
  return `${startText} – ${calendarDateText(end)}`;
}

@Pipe({ name: 'dateRange' })
export class DateRangePipe implements PipeTransform {
  transform(start: IsoDateString, end: IsoDateString): string {
    return dateRangeText(start, end);
  }
}

/** A point in time (created, updated) in the user's local time zone. */
@Pipe({ name: 'timestamp' })
export class TimestampPipe implements PipeTransform {
  private readonly datePipe = inject(DatePipe);
  transform(value: IsoDateString | null | undefined): string {
    return value ? (this.datePipe.transform(value, 'd MMM y, HH:mm') ?? '') : '';
  }
}

export function fullName(person: PersonRef | null | undefined): string {
  return person ? `${person.firstName} ${person.lastName}` : '';
}

@Pipe({ name: 'fullName' })
export class FullNamePipe implements PipeTransform {
  transform(person: PersonRef | null | undefined): string {
    return fullName(person);
  }
}

/** `yyyy-MM-dd` from an ISO string, for `<input type="date">` (no time zone shift). */
export function toDateInputValue(value: IsoDateString): string {
  return value.slice(0, 10);
}
