import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, map, Observable, of } from 'rxjs';
import { LeaveRequest, User } from '../../core/api/models';
import {
  ACTIVE_LEAVE_STATUSES,
  DepartmentsApi,
  HolidaysApi,
  LeaveRequestsApi,
  UsersApi,
} from '../../core/api/resources';
import { AuthService } from '../../core/auth/auth.service';
import { AbsenceGrid, AbsenceRow } from '../../shared/leave/absence-grid';
import { buildDays, CalendarDay } from '../../shared/leave/absence-layout';
import { leaveTypeColor } from '../../shared/leave/leave-type-color';
import { LeaveTypeLabel } from '../../shared/leave/leave-type-label';
import { Avatar } from '../../shared/ui/avatar';
import { EmptyState, LoadError } from '../../shared/ui/feedback';
import { Icon } from '../../shared/ui/icon';
import { PageHeader } from '../../shared/ui/page-header';
import { SearchInput } from '../../shared/ui/search-input';
import { StatusBadge } from '../../shared/ui/status-badge';
import { monthRange, rangesOverlap, shiftMonth, todayIso } from '../../shared/util/dates';
import { FullNamePipe, monthLabel } from '../../shared/util/format';

type Scope = 'team' | 'department' | 'all';

interface CalendarData {
  people: User[];
  requests: LeaveRequest[];
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

@Component({
  selector: 'app-calendar-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    AbsenceGrid,
    LeaveTypeLabel,
    Avatar,
    EmptyState,
    LoadError,
    Icon,
    PageHeader,
    SearchInput,
    StatusBadge,
    FullNamePipe,
  ],
  templateUrl: './calendar.page.html',
  styleUrl: './calendar.page.scss',
})
export default class CalendarPage {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly usersApi = inject(UsersApi);
  private readonly requestsApi = inject(LeaveRequestsApi);
  private readonly holidaysApi = inject(HolidaysApi);
  private readonly departmentsApi = inject(DepartmentsApi);

  // URL state: /calendar?month=2027-06&scope=department&department=3&q=anna
  readonly month = input<string>();
  readonly scope = input<string>();
  readonly department = input<string>();
  readonly q = input<string>();

  private readonly today = todayIso();
  private readonly user = computed(() => this.auth.user()!);

  /** Agenda list instead of the wall chart on narrow screens. */
  protected readonly narrow = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 899.98px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  protected readonly activeMonth = computed(() => {
    const month = this.month();
    return month && MONTH_PATTERN.test(month) ? month : this.today.slice(0, 7);
  });
  protected readonly monthTitle = computed(() => monthLabel(this.activeMonth()));

  /** The team a person belongs to: a Manager's own reports, an Employee's colleagues. */
  private readonly teamManagerId = computed(() => {
    const user = this.user();
    return user.role === 'Manager' ? user.id : (user.managerId ?? null);
  });

  protected readonly scopes = computed(() => {
    const options: { id: Scope; label: string }[] = [];
    if (this.teamManagerId()) options.push({ id: 'team', label: 'My team' });
    options.push({ id: 'department', label: 'Department' });
    options.push({ id: 'all', label: 'Everyone' });
    return options;
  });

  protected readonly activeScope = computed<Scope>(() => {
    const requested = this.scope() as Scope | undefined;
    if (requested && this.scopes().some((s) => s.id === requested)) return requested;
    return this.user().role === 'Hr' || !this.teamManagerId() ? 'all' : 'team';
  });

  protected readonly activeDepartment = computed(() => {
    const id = Number(this.department());
    return Number.isInteger(id) && id > 0 ? id : (this.user().departmentId ?? null);
  });

  protected readonly departments = rxResource({ stream: () => this.departmentsApi.listAll() });
  private readonly holidays = rxResource({ stream: () => this.holidaysApi.listAll() });

  protected readonly days = computed<CalendarDay[]>(() => {
    const { from, to } = monthRange(this.activeMonth());
    return buildDays(from, to, this.holidays.value() ?? [], this.today);
  });

  protected readonly data = rxResource({
    params: () => ({
      month: this.activeMonth(),
      scope: this.activeScope(),
      department: this.activeDepartment(),
    }),
    stream: ({ params }) => this.load(params.month, params.scope, params.department),
  });

  protected readonly rows = computed<AbsenceRow[]>(() => {
    const query = (this.q() ?? '').trim().toLowerCase();
    const departmentNames = new Map((this.departments.value() ?? []).map((d) => [d.id, d.name]));
    return (this.data.value()?.people ?? [])
      .filter((p) => !query || `${p.firstName} ${p.lastName}`.toLowerCase().includes(query))
      .map((person) => ({
        person,
        subtitle: person.departmentId ? departmentNames.get(person.departmentId) : undefined,
      }));
  });

  protected readonly visibleRequests = computed(() => {
    const ids = new Set(this.rows().map((r) => r.person.id));
    return (this.data.value()?.requests ?? []).filter((r) => ids.has(r.userId));
  });

  /** Leave types present this month, for the legend. */
  protected readonly legendTypes = computed(() => {
    const types = new Map<number, { id: number; name: string }>();
    for (const r of this.visibleRequests()) types.set(r.leaveType.id, r.leaveType);
    return [...types.values()];
  });

  /** Mobile agenda: working days on which someone is away, with who. */
  protected readonly agenda = computed(() =>
    this.days()
      .filter((day) => !day.isWeekend)
      .map((day) => ({
        day,
        absences: this.visibleRequests().filter((r) =>
          rangesOverlap(r.startDate, r.endDate, day.iso, day.iso),
        ),
      }))
      .filter((entry) => entry.absences.length > 0 || entry.day.holiday),
  );

  protected readonly caption = computed(
    () =>
      `${this.scopes().find((s) => s.id === this.activeScope())?.label} absences, ${this.monthTitle()}`,
  );

  protected color(leaveTypeId: number): string {
    return leaveTypeColor(leaveTypeId);
  }

  protected goToMonth(delta: number | 'today'): void {
    const month =
      delta === 'today' ? this.today.slice(0, 7) : shiftMonth(this.activeMonth(), delta);
    this.navigate({ month: month === this.today.slice(0, 7) ? null : month });
  }

  protected setScope(scope: Scope): void {
    this.navigate({ scope, department: null });
  }

  protected setDepartment(value: string): void {
    this.navigate({ department: value || null });
  }

  protected setSearch(q: string): void {
    this.navigate({ q: q || null });
  }

  private navigate(queryParams: Record<string, string | number | null>): void {
    void this.router.navigate([], { queryParams, queryParamsHandling: 'merge', replaceUrl: true });
  }

  private load(month: string, scope: Scope, departmentId: number | null): Observable<CalendarData> {
    const { from, to } = monthRange(month);
    const range = { from, to, status: ACTIVE_LEAVE_STATUSES };

    if (scope === 'department') {
      if (!departmentId) return of({ people: [], requests: [] });
      return forkJoin({
        people: this.usersApi.listAll({ departmentId }),
        requests: this.requestsApi.listAll({ ...range, departmentId }),
      });
    }

    if (scope === 'team') {
      const managerId = this.teamManagerId()!;
      // The team is the manager's direct reports plus the manager themselves.
      return forkJoin({
        manager: this.usersApi.get(managerId),
        reports: this.usersApi.listAll({ managerId }),
        reportRequests: this.requestsApi.listAll({ ...range, managerId }),
        managerRequests: this.requestsApi.listAll({ ...range, userId: managerId }),
      }).pipe(
        map((res) => ({
          people: [res.manager, ...res.reports],
          requests: [...res.managerRequests, ...res.reportRequests],
        })),
      );
    }

    return forkJoin({
      people: this.usersApi.listAll(),
      requests: this.requestsApi.listAll(range),
    });
  }
}
