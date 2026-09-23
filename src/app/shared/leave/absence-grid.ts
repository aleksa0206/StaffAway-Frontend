import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LeaveRequest, PersonRef } from '../../core/api/models';
import { Avatar } from '../ui/avatar';
import { Tooltip } from '../ui/tooltip';
import { calendarDateText } from '../util/format';
import { AbsenceBar, CalendarDay, awayCounts, layoutBars } from './absence-layout';
import { leaveTypeColor } from './leave-type-color';

export interface AbsenceRow {
  person: PersonRef;
  subtitle?: string | undefined;
}

/**
 * Wall chart: one row per person, one column per day, a bar per absence.
 * Semantically a table (row headers = people); bars are links in reading order, so keyboard
 * users can Tab through absences, and each bar carries a full text description.
 */
@Component({
  selector: 'app-absence-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Avatar, Tooltip],
  templateUrl: './absence-grid.html',
  styleUrl: './absence-grid.scss',
  host: { '[style.--days]': 'days().length' },
})
export class AbsenceGrid {
  readonly rows = input.required<readonly AbsenceRow[]>();
  readonly days = input.required<readonly CalendarDay[]>();
  readonly requests = input.required<readonly LeaveRequest[]>();
  /** Accessible name of the table, e.g. "Team absences, June 2027". */
  readonly caption = input.required<string>();
  readonly compact = input(false);
  readonly showAvailability = input(true);

  protected readonly bars = computed(() => layoutBars(this.requests(), this.days()));
  protected readonly counts = computed(() => awayCounts(this.requests(), this.days()));

  /** Highlight days when a noticeable part of the group is away. */
  protected readonly busyThreshold = computed(() =>
    Math.max(2, Math.ceil(this.rows().length * 0.3)),
  );

  protected barsFor(userId: number): AbsenceBar[] {
    return this.bars().get(userId) ?? [];
  }

  protected color(bar: AbsenceBar): string {
    return leaveTypeColor(bar.request.leaveTypeId);
  }

  protected describe(bar: AbsenceBar, person: PersonRef): string {
    const r = bar.request;
    const status = r.status === 'Pending' ? 'pending approval' : 'approved';
    const days = `${r.totalDays} working day${r.totalDays === 1 ? '' : 's'}`;
    return `${person.firstName} ${person.lastName}: ${r.leaveType.name}, ${calendarDateText(r.startDate)} – ${calendarDateText(r.endDate)} (${days}, ${status})`;
  }
}
