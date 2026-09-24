import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { LeaveBalance, User, WorkSchedule } from '../../core/api/models';
import {
  DepartmentsApi,
  LeaveBalancesApi,
  LeaveRequestsApi,
  UsersApi,
  WorkSchedulesApi,
} from '../../core/api/resources';
import { AuthService } from '../../core/auth/auth.service';
import { LeaveTypeLabel } from '../../shared/leave/leave-type-label';
import { Avatar } from '../../shared/ui/avatar';
import { BalanceTable } from '../../shared/ui/balance-table';
import { ConfirmService } from '../../shared/ui/confirm-dialog';
import { FormDialogService } from '../../shared/ui/dialogs';
import { LoadError } from '../../shared/ui/feedback';
import { Icon } from '../../shared/ui/icon';
import { PageHeader } from '../../shared/ui/page-header';
import { Pagination } from '../../shared/ui/pagination';
import { TabItem, Tabs } from '../../shared/ui/tabs';
import { StatusBadge } from '../../shared/ui/status-badge';
import { ToastService } from '../../shared/ui/toast';
import { CalendarDatePipe, DateRangePipe, FullNamePipe, fullName } from '../../shared/util/format';
import { parsePage } from '../../shared/util/query';
import { ROLE_LABELS } from './roles';
import { BalanceDialog, BalanceDialogData } from './ui/balance-dialog';
import { WorkScheduleDialog, WorkScheduleDialogData } from './ui/work-schedule-dialog';

type Tab = 'overview' | 'leave';

@Component({
  selector: 'app-person-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    PageHeader,
    LoadError,
    Icon,
    Avatar,
    BalanceTable,
    LeaveTypeLabel,
    Pagination,
    StatusBadge,
    Tabs,
    CalendarDatePipe,
    DateRangePipe,
    FullNamePipe,
  ],
  templateUrl: './person-detail.page.html',
  styleUrl: './person-detail.page.scss',
})
export default class PersonDetailPage {
  private readonly usersApi = inject(UsersApi);
  private readonly departmentsApi = inject(DepartmentsApi);
  private readonly balancesApi = inject(LeaveBalancesApi);
  private readonly schedulesApi = inject(WorkSchedulesApi);
  private readonly requestsApi = inject(LeaveRequestsApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly dialogs = inject(FormDialogService);
  private readonly toast = inject(ToastService);

  readonly id = input.required<string>();
  readonly tab = input<string>();
  readonly page = input<string>();

  protected readonly activeTab = computed<Tab>(() =>
    this.tab() === 'leave' ? 'leave' : 'overview',
  );
  protected readonly tabs: TabItem[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'leave', label: 'Leave' },
  ];
  private readonly userId = computed(() => Number(this.id()));

  protected readonly roleLabels = ROLE_LABELS;
  protected readonly isHr = computed(() => this.auth.hasRole('Hr'));
  protected readonly isSelf = computed(() => this.auth.user()?.id === this.userId());

  protected readonly person = rxResource({
    params: () => this.userId(),
    stream: ({ params: id }) => this.usersApi.get(id),
  });
  private readonly manager = rxResource({
    params: () => this.person.value()?.managerId ?? undefined,
    stream: ({ params: id }) => (id ? this.usersApi.get(id) : of(null)),
  });
  private readonly departments = rxResource({ stream: () => this.departmentsApi.listAll() });
  protected readonly balances = rxResource({
    params: () => this.userId(),
    stream: ({ params: id }) => this.balancesApi.listForUser(id),
  });
  protected readonly schedule = rxResource({
    params: () => this.userId(),
    stream: ({ params: id }) => this.schedulesApi.getForUser(id),
  });
  protected readonly requests = rxResource({
    params: () => ({ userId: this.userId(), page: parsePage(this.page()) }),
    stream: ({ params }) => this.requestsApi.list({ ...params, sort: '-startDate' }),
  });

  protected readonly managerName = computed(() => fullName(this.manager.value()) || '—');
  protected readonly departmentName = computed(() => {
    const id = this.person.value()?.departmentId;
    return (id && this.departments.value()?.find((d) => d.id === id)?.name) || '—';
  });

  protected selectTab(tab: string): void {
    void this.router.navigate([], {
      queryParams: { tab: tab === 'overview' ? null : tab, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected goToPage(page: number): void {
    void this.router.navigate([], { queryParams: { page }, queryParamsHandling: 'merge' });
  }

  protected async removeSchedule(schedule: WorkSchedule): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: 'Remove work schedule?',
      message: 'The person will have no recorded working hours until a new schedule is set.',
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!confirmed) return;
    this.schedulesApi.remove(schedule.id).subscribe({
      next: () => {
        this.schedule.set(null);
        this.toast.success('Work schedule removed.');
      },
      error: (err: unknown) => this.toast.error(toApiError(err).message),
    });
  }

  protected async addBalance(): Promise<void> {
    const saved = await this.dialogs.open<LeaveBalance, BalanceDialogData>(
      BalanceDialog,
      { userId: this.userId() },
      'balance-dialog-title',
    );
    if (saved) {
      this.balances.reload();
      this.toast.success('Balance added.');
    }
  }

  protected async editBalance(balance: LeaveBalance): Promise<void> {
    const saved = await this.dialogs.open<LeaveBalance, BalanceDialogData>(
      BalanceDialog,
      { userId: this.userId(), balance },
      'balance-dialog-title',
    );
    if (saved) {
      this.balances.reload();
      this.toast.success('Balance saved.');
    }
  }

  protected async removeBalance(balance: LeaveBalance): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: 'Delete balance?',
      message: `The "${balance.leaveType.name}" balance for ${balance.year} will be deleted. Requests of that type for that year cannot be approved until a new one is added.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!confirmed) return;
    this.balancesApi.remove(balance.id).subscribe({
      next: () => this.balances.reload(),
      error: (err: unknown) => this.toast.error(toApiError(err).message),
    });
  }

  protected async editSchedule(schedule: WorkSchedule | null): Promise<void> {
    const saved = await this.dialogs.open<WorkSchedule, WorkScheduleDialogData>(
      WorkScheduleDialog,
      { userId: this.userId(), schedule },
      'schedule-dialog-title',
    );
    if (saved) {
      this.schedule.set(saved);
      this.toast.success('Schedule saved.');
    }
  }

  protected async remove(person: User): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: `Delete the account of ${fullName(person)}?`,
      message:
        'The account is permanently deleted. If the person has requests, balances or other related data, deletion will not be possible.',
      confirmLabel: 'Delete account',
      tone: 'danger',
    });
    if (!confirmed) return;
    this.usersApi.remove(person.id).subscribe({
      next: () => {
        this.toast.success('Account deleted.');
        void this.router.navigate(['/people']);
      },
      error: (err: unknown) => this.toast.error(toApiError(err).message),
    });
  }
}
