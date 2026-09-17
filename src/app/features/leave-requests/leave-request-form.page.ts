import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, finalize, forkJoin, map, of } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import {
  ACTIVE_LEAVE_STATUSES,
  CompanyApi,
  HolidaysApi,
  LeaveBalancesApi,
  LeaveRequestsApi,
  LeaveTypesApi,
  UsersApi,
} from '../../core/api/resources';
import { AuthService } from '../../core/auth/auth.service';
import { overlappingRequests } from '../../shared/leave/absence-layout';
import { balanceBreakdown } from '../../shared/leave/balance-breakdown';
import { LeaveTypeLabel } from '../../shared/leave/leave-type-label';
import { Avatar } from '../../shared/ui/avatar';
import { LoadError } from '../../shared/ui/feedback';
import { FieldControl, FormField } from '../../shared/ui/form-field';
import { Icon } from '../../shared/ui/icon';
import { PageHeader } from '../../shared/ui/page-header';
import { ToastService } from '../../shared/ui/toast';
import { todayIso } from '../../shared/util/dates';
import { DateRangePipe, FullNamePipe, fullName, toDateInputValue } from '../../shared/util/format';
import { applyServerErrors } from '../../shared/util/forms';
import { canModifyRequest } from './leave-request-permissions';
import { countWorkingDays } from './working-days';

interface Period {
  startDate: string;
  endDate: string;
  year: number;
}

@Component({
  selector: 'app-leave-request-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PageHeader,
    FormField,
    FieldControl,
    LoadError,
    LeaveTypeLabel,
    Avatar,
    Icon,
    DateRangePipe,
    FullNamePipe,
  ],
  templateUrl: './leave-request-form.page.html',
  styleUrl: './leave-request-form.page.scss',
})
export default class LeaveRequestFormPage {
  private readonly requestsApi = inject(LeaveRequestsApi);
  private readonly leaveTypesApi = inject(LeaveTypesApi);
  private readonly holidaysApi = inject(HolidaysApi);
  private readonly companyApi = inject(CompanyApi);
  private readonly balancesApi = inject(LeaveBalancesApi);
  private readonly usersApi = inject(UsersApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /** Only present on the `:id/edit` route. */
  readonly id = input<string>();
  protected readonly isEdit = computed(() => this.id() !== undefined);

  private readonly today = todayIso();
  private readonly user = computed(() => this.auth.user()!);

  protected readonly leaveTypes = rxResource({ stream: () => this.leaveTypesApi.listAll() });
  private readonly holidays = rxResource({ stream: () => this.holidaysApi.listAll() });
  private readonly settings = rxResource({ stream: () => this.companyApi.getSettings() });
  protected readonly existing = rxResource({
    params: () => this.id(),
    stream: ({ params: id }) => (id ? this.requestsApi.get(Number(id)) : of(null)),
  });

  /** Who approves the request: shown in the summary so the employee knows what happens next. */
  protected readonly approver = rxResource({
    params: () => this.user().managerId ?? undefined,
    stream: ({ params: managerId }) => (managerId ? this.usersApi.get(managerId) : of(null)),
  });

  protected readonly form = inject(NonNullableFormBuilder).group({
    leaveTypeId: [0, Validators.min(1)],
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    comment: ['', Validators.maxLength(1000)],
  });

  protected readonly submitting = signal(false);
  protected readonly formError = signal<string | null>(null);

  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly selectedType = computed(() => {
    const id = Number(this.form.getRawValue().leaveTypeId || this.formValue().leaveTypeId);
    return this.leaveTypes.value()?.find((t) => t.id === id) ?? null;
  });

  /** The dates once they form a valid range; the summary only reacts to complete input. */
  private readonly period = toSignal(
    this.form.valueChanges.pipe(
      debounceTime(250),
      map((): Period | null => {
        const { startDate, endDate } = this.form.getRawValue();
        return startDate && endDate && endDate >= startDate
          ? { startDate, endDate, year: Number(startDate.slice(0, 4)) }
          : null;
      }),
    ),
    { initialValue: null },
  );

  protected readonly workingDays = computed(() => {
    const { startDate, endDate } = this.formValue();
    return startDate && endDate
      ? countWorkingDays(startDate, endDate, this.holidays.value() ?? [])
      : null;
  });

  protected readonly minNoticeDays = computed(
    () => this.settings.value()?.minDaysNoticeForLeave ?? 1,
  );

  // ---------- Summary: balance and conflicts for the chosen period ----------

  private readonly teamManagerId = computed(() => {
    const user = this.user();
    return user.role === 'Manager' ? user.id : (user.managerId ?? null);
  });

  protected readonly context = rxResource({
    params: () => this.period(),
    stream: ({ params: period }) => {
      if (!period) return of(null);
      const userId = this.user().id;
      const managerId = this.teamManagerId();
      return forkJoin({
        balances: this.balancesApi.listForUser(userId, period.year),
        myYear: this.requestsApi.listAll({
          userId,
          status: ACTIVE_LEAVE_STATUSES,
          from: `${period.year}-01-01`,
          to: `${period.year}-12-31`,
        }),
        team: managerId
          ? this.requestsApi.listAll({
              managerId,
              status: ACTIVE_LEAVE_STATUSES,
              from: period.startDate,
              to: period.endDate,
            })
          : of([]),
      });
    },
  });

  /** Balance for the chosen type in the start year, excluding this request when editing. */
  protected readonly balance = computed(() => {
    const context = this.context.value();
    const type = this.selectedType();
    if (!context || !type?.countsTowardBalance) return null;
    const editingId = this.existing.value()?.id;
    const others = context.myYear.filter((r) => r.id !== editingId);
    const row = balanceBreakdown(context.balances, others, this.today).find(
      (b) => b.leaveType.id === type.id,
    );
    if (!row) return { missing: true as const };
    const available = row.remaining - row.pending;
    const requested = this.workingDays() ?? 0;
    return {
      missing: false as const,
      available,
      after: available - requested,
      pending: row.pending,
    };
  });

  protected readonly ownConflicts = computed(() => {
    const context = this.context.value();
    const period = this.period();
    if (!context || !period) return [];
    const editingId = this.existing.value()?.id;
    return context.myYear.filter(
      (r) =>
        r.id !== editingId &&
        r.startDate.slice(0, 10) <= period.endDate &&
        r.endDate.slice(0, 10) >= period.startDate,
    );
  });

  protected readonly teamAway = computed(() => {
    const context = this.context.value();
    const period = this.period();
    if (!context || !period) return [];
    const others = overlappingRequests(context.team, { userId: this.user().id, ...period });
    const byPerson = new Map(others.map((r) => [r.userId, r]));
    return [...byPerson.values()];
  });

  protected readonly readOnlyReason = computed(() => {
    const request = this.existing.value();
    const user = this.auth.user();
    if (!request || !user) return null;
    return canModifyRequest(request, user)
      ? null
      : 'This request can no longer be edited: only your own pending requests can be changed.';
  });

  protected readonly approverName = computed(() => fullName(this.approver.value()));

  constructor() {
    effect(() => {
      const request = this.existing.value();
      if (request) {
        this.form.setValue({
          leaveTypeId: request.leaveTypeId,
          startDate: toDateInputValue(request.startDate),
          endDate: toDateInputValue(request.endDate),
          comment: request.comment ?? '',
        });
        // The backend doesn't allow changing the type of an existing request.
        this.form.controls.leaveTypeId.disable();
      }
    });
  }

  protected submit(): void {
    this.formError.set(null);
    const { startDate, endDate } = this.form.getRawValue();
    if (startDate && endDate && endDate < startDate) {
      this.form.controls.endDate.setErrors({
        range: 'The end date cannot be before the start date.',
      });
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const totalDays = this.workingDays() ?? 0;
    if (totalDays === 0) {
      this.formError.set(
        'The selected period has no working days (weekends and holidays are not counted).',
      );
      return;
    }

    const { leaveTypeId, comment } = this.form.getRawValue();
    const id = this.id();
    const request$ = id
      ? this.requestsApi.update(Number(id), { startDate, endDate, totalDays, comment })
      : this.requestsApi.create({
          leaveTypeId,
          startDate,
          endDate,
          totalDays,
          ...(comment ? { comment } : {}),
        });

    this.submitting.set(true);
    request$.pipe(finalize(() => this.submitting.set(false))).subscribe({
      next: (saved) => {
        this.toast.success(
          id
            ? 'Request updated.'
            : saved.status === 'Approval'
              ? 'Leave recorded. This type is approved automatically.'
              : 'Request submitted. Your manager has been notified.',
        );
        void this.router.navigate(['/requests', saved.id]);
      },
      error: (err: unknown) => {
        const apiError = toApiError(err);
        if (!applyServerErrors(this.form, apiError)) {
          this.formError.set(apiError.message);
        }
      },
    });
  }

  protected cancel(): void {
    const id = this.id();
    void this.router.navigate(id ? ['/requests', id] : ['/leave']);
  }
}
