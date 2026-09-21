import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  ACTIVE_LEAVE_STATUSES,
  LeaveBalancesApi,
  LeaveRequestQuery,
  LeaveRequestsApi,
} from '../../core/api/resources';
import { AuthService } from '../../core/auth/auth.service';
import { balanceBreakdown } from '../../shared/leave/balance-breakdown';
import { BalanceSummary } from '../../shared/leave/balance-summary';
import { LeaveTypeLabel } from '../../shared/leave/leave-type-label';
import { EmptyState, LoadError, SkeletonRows } from '../../shared/ui/feedback';
import { PageHeader } from '../../shared/ui/page-header';
import { Pagination } from '../../shared/ui/pagination';
import { StatusBadge } from '../../shared/ui/status-badge';
import { TabItem, Tabs } from '../../shared/ui/tabs';
import { todayIso } from '../../shared/util/dates';
import { DateRangePipe, TimestampPipe } from '../../shared/util/format';
import { parsePage } from '../../shared/util/query';

type Tab = 'upcoming' | 'pending' | 'all';

const EMPTY_TEXT: Record<Tab, { title: string; description: string }> = {
  upcoming: {
    title: 'No upcoming leave',
    description: 'Approved and pending requests from today onwards appear here.',
  },
  pending: {
    title: 'Nothing waiting for approval',
    description: 'Your manager has decided on all your requests.',
  },
  all: {
    title: "You haven't requested any leave yet",
    description: 'Requests go to your manager for approval.',
  },
};

@Component({
  selector: 'app-my-leave-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    BalanceSummary,
    LeaveTypeLabel,
    EmptyState,
    LoadError,
    SkeletonRows,
    PageHeader,
    Pagination,
    StatusBadge,
    Tabs,
    DateRangePipe,
    TimestampPipe,
  ],
  templateUrl: './my-leave.page.html',
})
export default class MyLeavePage {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly requestsApi = inject(LeaveRequestsApi);
  private readonly balancesApi = inject(LeaveBalancesApi);

  readonly tab = input<string>();
  readonly page = input<string>();
  readonly year = input<string>();

  private readonly today = todayIso();
  private readonly currentYear = Number(this.today.slice(0, 4));
  private readonly userId = computed(() => this.auth.user()!.id);

  protected readonly years = [this.currentYear + 1, this.currentYear, this.currentYear - 1];
  protected readonly activeYear = computed(() => {
    const year = Number(this.year());
    return this.years.includes(year) ? year : this.currentYear;
  });

  protected readonly activeTab = computed<Tab>(() =>
    this.tab() === 'pending' || this.tab() === 'all' ? (this.tab() as Tab) : 'upcoming',
  );
  protected readonly emptyText = computed(() => EMPTY_TEXT[this.activeTab()]);

  // ---------- Balance ----------

  protected readonly balanceData = rxResource({
    params: () => ({ userId: this.userId(), year: this.activeYear() }),
    stream: ({ params }) =>
      forkJoin({
        balances: this.balancesApi.listForUser(params.userId, params.year),
        requests: this.requestsApi.listAll({
          userId: params.userId,
          status: ACTIVE_LEAVE_STATUSES,
          from: `${params.year}-01-01`,
          to: `${params.year}-12-31`,
        }),
      }),
  });

  protected readonly breakdown = computed(() => {
    const data = this.balanceData.value();
    return data ? balanceBreakdown(data.balances, data.requests, this.today) : [];
  });

  // ---------- Requests ----------

  private readonly pendingCount = rxResource({
    params: () => this.userId(),
    stream: ({ params: userId }) => this.requestsApi.list({ userId, status: 'Pending', limit: 1 }),
  });

  protected readonly tabs = computed<TabItem[]>(() => [
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'pending', label: 'Pending', count: this.pendingCount.value()?.meta.total },
    { id: 'all', label: 'All requests' },
  ]);

  protected readonly requests = rxResource({
    params: () => ({ tab: this.activeTab(), page: parsePage(this.page()), userId: this.userId() }),
    stream: ({ params }) => {
      const base: LeaveRequestQuery = { userId: params.userId, page: params.page };
      const byTab: Record<Tab, LeaveRequestQuery> = {
        upcoming: { ...base, status: ACTIVE_LEAVE_STATUSES, from: this.today, sort: 'startDate' },
        pending: { ...base, status: 'Pending', sort: 'startDate' },
        all: { ...base, sort: '-startDate' },
      };
      return this.requestsApi.list(byTab[params.tab]);
    },
  });

  protected selectTab(tab: string): void {
    void this.router.navigate([], {
      queryParams: { tab: tab === 'upcoming' ? null : tab, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected setYear(value: string): void {
    const year = Number(value);
    void this.router.navigate([], {
      queryParams: { year: year === this.currentYear ? null : year },
      queryParamsHandling: 'merge',
    });
  }

  protected goToPage(page: number): void {
    void this.router.navigate([], { queryParams: { page }, queryParamsHandling: 'merge' });
  }
}
