import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin, map, of } from 'rxjs';
import { LeaveRequest, User } from '../../core/api/models';
import {
  ACTIVE_LEAVE_STATUSES,
  HolidaysApi,
  LeaveBalancesApi,
  LeaveRequestsApi,
  UsersApi,
} from '../../core/api/resources';
import { AuthService } from '../../core/auth/auth.service';
import { PendingApprovalsService } from '../../core/pending-approvals.service';
import { AbsenceGrid, AbsenceRow } from '../../shared/leave/absence-grid';
import { buildDays } from '../../shared/leave/absence-layout';
import { balanceBreakdown } from '../../shared/leave/balance-breakdown';
import { BalanceSummary } from '../../shared/leave/balance-summary';
import { LeaveTypeLabel } from '../../shared/leave/leave-type-label';
import { Avatar } from '../../shared/ui/avatar';
import { EmptyState, LoadError } from '../../shared/ui/feedback';
import { Icon } from '../../shared/ui/icon';
import { StatusBadge } from '../../shared/ui/status-badge';
import { addDays, todayIso } from '../../shared/util/dates';
import { DateRangePipe, formatCalendar, formatLocal, FullNamePipe } from '../../shared/util/format';
import { LeaveDecisionsService } from '../leave-requests/leave-decisions.service';

const TEAM_WINDOW_DAYS = 14;
const LIST_SIZE = 5;

@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    AbsenceGrid,
    BalanceSummary,
    LeaveTypeLabel,
    Avatar,
    EmptyState,
    LoadError,
    Icon,
    StatusBadge,
    DateRangePipe,
    FullNamePipe,
  ],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export default class HomePage {
  private readonly requestsApi = inject(LeaveRequestsApi);
  private readonly balancesApi = inject(LeaveBalancesApi);
  private readonly usersApi = inject(UsersApi);
  private readonly holidaysApi = inject(HolidaysApi);
  private readonly decisions = inject(LeaveDecisionsService);
  private readonly pendingApprovals = inject(PendingApprovalsService);
  protected readonly auth = inject(AuthService);

  protected readonly today = todayIso();
  protected readonly todayText = formatLocal(new Date(), 'EEEE, d MMMM y');
  private readonly year = Number(this.today.slice(0, 4));

  protected readonly user = computed(() => this.auth.user()!);
  protected readonly isManager = computed(() => this.auth.hasRole('Manager'));
  protected readonly isHr = computed(() => this.auth.hasRole('Hr'));
  protected readonly decides = computed(() => this.isManager() || this.isHr());

  // ---------- My leave ----------

  protected readonly myYear = rxResource({
    params: () => this.user().id,
    stream: ({ params: userId }) =>
      forkJoin({
        balances: this.balancesApi.listForUser(userId, this.year),
        requests: this.requestsApi.listAll({
          userId,
          status: ACTIVE_LEAVE_STATUSES,
          from: `${this.year}-01-01`,
          to: `${this.year}-12-31`,
        }),
      }),
  });

  protected readonly breakdown = computed(() => {
    const data = this.myYear.value();
    return data ? balanceBreakdown(data.balances, data.requests, this.today) : [];
  });

  protected readonly primary = computed(() => this.breakdown()[0] ?? null);

  protected readonly myUpcoming = rxResource({
    params: () => this.user().id,
    stream: ({ params: userId }) =>
      this.requestsApi
        .list({
          userId,
          status: ACTIVE_LEAVE_STATUSES,
          from: this.today,
          sort: 'startDate',
          limit: LIST_SIZE,
        })
        .pipe(map((res) => res.data)),
  });

  protected readonly nextLeave = computed(
    () => this.myUpcoming.value()?.find((r) => r.status === 'Approval') ?? null,
  );

  protected readonly myPendingCount = computed(
    () => this.myUpcoming.value()?.filter((r) => r.status === 'Pending').length ?? 0,
  );

  // ---------- Decisions (Manager / Hr) ----------

  protected readonly decidingId = signal<number | null>(null);

  protected readonly toDecide = rxResource({
    params: () => (this.decides() ? this.user() : null),
    stream: ({ params: user }) =>
      user
        ? this.requestsApi.list({
            status: 'Pending',
            managerId: user.role === 'Manager' ? user.id : undefined,
            sort: 'startDate',
            limit: LIST_SIZE,
          })
        : of(null),
  });

  protected readonly decidable = computed(
    () => this.toDecide.value()?.data.filter((r) => r.userId !== this.user().id) ?? [],
  );

  // ---------- Team availability ----------

  /** Whose absences a person sees on Home: a Manager their reports, an Employee their team. */
  private readonly teamManagerId = computed(() =>
    this.isManager() ? this.user().id : (this.user().managerId ?? null),
  );

  protected readonly holidays = rxResource({
    stream: () => this.holidaysApi.listAll(),
  });

  protected readonly calendarDays = computed(() =>
    buildDays(
      this.today,
      addDays(this.today, TEAM_WINDOW_DAYS - 1),
      this.holidays.value() ?? [],
      this.today,
    ),
  );

  protected readonly team = rxResource({
    params: () => (this.isHr() ? null : this.teamManagerId()),
    stream: ({ params: managerId }) =>
      managerId
        ? forkJoin({
            people: this.usersApi.listAll({ managerId }),
            requests: this.requestsApi.listAll({
              managerId,
              status: ACTIVE_LEAVE_STATUSES,
              from: this.today,
              to: addDays(this.today, TEAM_WINDOW_DAYS - 1),
            }),
          })
        : of(null),
  });

  protected readonly teamRows = computed<AbsenceRow[]>(() =>
    (this.team.value()?.people ?? []).map((person: User) => ({ person })),
  );

  // ---------- Company today (Hr) ----------

  protected readonly company = rxResource({
    params: () => (this.isHr() ? this.today : null),
    stream: ({ params: today }) =>
      today
        ? forkJoin({
            awayToday: this.requestsApi.listAll({ status: ['Approval'], from: today, to: today }),
            awayThisWeek: this.requestsApi.list({
              status: ACTIVE_LEAVE_STATUSES,
              from: today,
              to: addDays(today, 6),
              sort: 'startDate',
              limit: 1,
            }),
            headcount: this.usersApi.list({ limit: 1 }),
          }).pipe(
            map(({ awayToday, awayThisWeek, headcount }) => ({
              awayToday,
              awayThisWeekCount: awayThisWeek.meta.total,
              headcount: headcount.meta.total,
            })),
          )
        : of(null),
  });

  protected monthShort(iso: string): string {
    return formatCalendar(iso, 'MMM');
  }

  protected approve(request: LeaveRequest): void {
    void this.decide(request, this.decisions.approve(request));
  }

  protected reject(request: LeaveRequest): void {
    void this.decide(request, this.decisions.reject(request));
  }

  private async decide(
    request: LeaveRequest,
    decision: Promise<LeaveRequest | null>,
  ): Promise<void> {
    this.decidingId.set(request.id);
    const updated = await decision;
    this.decidingId.set(null);
    if (updated) {
      this.toDecide.reload();
      this.team.reload();
      this.pendingApprovals.refresh();
    }
  }
}
