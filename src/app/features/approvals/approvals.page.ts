import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { LEAVE_STATUSES, LeaveBalance, LeaveRequest } from '../../core/api/models';
import {
  ACTIVE_LEAVE_STATUSES,
  LeaveBalancesApi,
  LeaveRequestsApi,
} from '../../core/api/resources';
import { AuthService } from '../../core/auth/auth.service';
import { PendingApprovalsService } from '../../core/pending-approvals.service';
import { overlappingRequests } from '../../shared/leave/absence-layout';
import { LeaveTypeLabel } from '../../shared/leave/leave-type-label';
import { Avatar } from '../../shared/ui/avatar';
import { EmptyState, LoadError, SkeletonRows } from '../../shared/ui/feedback';
import { PageHeader } from '../../shared/ui/page-header';
import { Pagination } from '../../shared/ui/pagination';
import { leaveStatusLabel, StatusBadge } from '../../shared/ui/status-badge';
import { Tooltip } from '../../shared/ui/tooltip';
import { DateRangePipe, FullNamePipe, fullName } from '../../shared/util/format';
import { parseOption, parsePage } from '../../shared/util/query';
import { LeaveDecisionsService } from '../leave-requests/leave-decisions.service';

const ALL = 'all';

interface ApprovalRow {
  request: LeaveRequest;
  /** Remaining days for this type in the request's year (null: type not counted or no balance). */
  remaining: number | null;
  overlaps: LeaveRequest[];
}

@Component({
  selector: 'app-approvals-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    PageHeader,
    Pagination,
    StatusBadge,
    EmptyState,
    LoadError,
    SkeletonRows,
    LeaveTypeLabel,
    Avatar,
    Tooltip,
    DateRangePipe,
    FullNamePipe,
  ],
  templateUrl: './approvals.page.html',
  styleUrl: './approvals.page.scss',
})
export default class ApprovalsPage {
  private readonly api = inject(LeaveRequestsApi);
  private readonly balancesApi = inject(LeaveBalancesApi);
  private readonly router = inject(Router);
  private readonly decisions = inject(LeaveDecisionsService);
  private readonly pendingApprovals = inject(PendingApprovalsService);
  protected readonly auth = inject(AuthService);

  readonly page = input<string>();
  readonly status = input<string>();

  protected readonly statuses = LEAVE_STATUSES.map((value) => ({
    value,
    label: leaveStatusLabel(value),
  }));
  /** By default, show what is awaiting a decision. */
  protected readonly activeStatus = computed(() =>
    this.status() === ALL ? ALL : (parseOption(this.status(), LEAVE_STATUSES) ?? 'Pending'),
  );
  protected readonly isManager = computed(() => this.auth.hasRole('Manager'));
  protected readonly pendingId = signal<number | null>(null);

  /**
   * One page of requests, plus the context a decision needs: each requester's balance and who
   * else from the same group is away at the same time. Two extra requests per page, not per row.
   */
  protected readonly data = rxResource({
    params: () => ({
      // A Manager only decides on direct reports, so they only see those.
      managerId: this.isManager() ? this.auth.user()?.id : undefined,
      status: parseOption(this.activeStatus(), LEAVE_STATUSES),
      page: parsePage(this.page()),
    }),
    stream: ({ params }) =>
      this.api.list({ ...params, sort: 'startDate' }).pipe(
        switchMap((page) => {
          const requests = page.data;
          if (requests.length === 0) {
            return of({ page, balances: [] as LeaveBalance[], nearby: [] as LeaveRequest[] });
          }
          const from = requests.map((r) => r.startDate.slice(0, 10)).sort()[0];
          const to = requests
            .map((r) => r.endDate.slice(0, 10))
            .sort()
            .at(-1);
          return forkJoin({
            balances: this.balancesApi.listForUsers([...new Set(requests.map((r) => r.userId))]),
            nearby: this.api.listAll({
              managerId: params.managerId,
              status: ACTIVE_LEAVE_STATUSES,
              from,
              to,
            }),
          }).pipe(map((context) => ({ page, ...context })));
        }),
      ),
  });

  protected readonly rows = computed<ApprovalRow[]>(() => {
    const data = this.data.value();
    if (!data) return [];
    return data.page.data.map((request) => {
      const balance = data.balances.find(
        (b) =>
          b.userId === request.userId &&
          b.leaveTypeId === request.leaveTypeId &&
          b.year === Number(request.startDate.slice(0, 4)),
      );
      return {
        request,
        remaining: balance ? balance.totalDays - balance.usedDays : null,
        overlaps: overlappingRequests(data.nearby, request),
      };
    });
  });

  protected isOwn(request: LeaveRequest): boolean {
    return request.userId === this.auth.user()?.id;
  }

  protected overlapText(row: ApprovalRow): string {
    return row.overlaps
      .map((r) => `${fullName(r.user)} (${r.status === 'Pending' ? 'pending' : 'approved'})`)
      .join('\n');
  }

  protected setStatus(value: string): void {
    void this.router.navigate([], {
      queryParams: { status: value === 'Pending' ? null : value, page: null },
    });
  }

  protected goToPage(page: number): void {
    void this.router.navigate([], { queryParams: { page }, queryParamsHandling: 'merge' });
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
    this.pendingId.set(request.id);
    const updated = await decision;
    this.pendingId.set(null);
    if (updated) {
      this.data.reload();
      this.pendingApprovals.refresh();
    }
  }
}
