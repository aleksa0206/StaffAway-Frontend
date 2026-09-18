import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { finalize, of } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { LeaveRequest } from '../../core/api/models';
import { LeaveRequestsApi, UsersApi } from '../../core/api/resources';
import { AuthService } from '../../core/auth/auth.service';
import { PendingApprovalsService } from '../../core/pending-approvals.service';
import { LeaveTypeLabel } from '../../shared/leave/leave-type-label';
import { Avatar } from '../../shared/ui/avatar';
import { ConfirmService } from '../../shared/ui/confirm-dialog';
import { LoadError } from '../../shared/ui/feedback';
import { Icon } from '../../shared/ui/icon';
import { PageHeader } from '../../shared/ui/page-header';
import { StatusBadge } from '../../shared/ui/status-badge';
import { ToastService } from '../../shared/ui/toast';
import { todayIso } from '../../shared/util/dates';
import { CalendarDatePipe, FullNamePipe, TimestampPipe } from '../../shared/util/format';
import { LeaveDecisionsService } from './leave-decisions.service';
import {
  canCancelRequest,
  canCommentOnRequest,
  canDecideRequest,
  canModifyRequest,
} from './leave-request-permissions';
import { RequestAttachments } from './ui/request-attachments';
import { RequestComments } from './ui/request-comments';
import { RequestHistory } from './ui/request-history';

@Component({
  selector: 'app-leave-request-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    LeaveTypeLabel,
    Avatar,
    PageHeader,
    StatusBadge,
    LoadError,
    Icon,
    RequestHistory,
    RequestComments,
    RequestAttachments,
    CalendarDatePipe,
    TimestampPipe,
    FullNamePipe,
  ],
  templateUrl: './leave-request-detail.page.html',
  styleUrl: './leave-request-detail.page.scss',
})
export default class LeaveRequestDetailPage {
  private readonly api = inject(LeaveRequestsApi);
  private readonly usersApi = inject(UsersApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly decisions = inject(LeaveDecisionsService);
  private readonly pendingApprovals = inject(PendingApprovalsService);

  readonly id = input.required<string>();

  protected readonly request = rxResource({
    params: () => Number(this.id()),
    stream: ({ params: id }) => this.api.get(id),
  });

  // A Manager may only decide on direct reports; that needs the requester's managerId.
  private readonly requester = rxResource({
    params: () => {
      const request = this.request.value();
      return request && this.auth.hasRole('Manager') ? request.userId : undefined;
    },
    stream: ({ params: userId }) => (userId ? this.usersApi.get(userId) : of(null)),
  });

  protected readonly busy = signal(false);
  protected readonly historyVersion = signal(0);

  protected readonly permissions = computed(() => {
    const request = this.request.value();
    const user = this.auth.user();
    if (!request || !user) {
      return { modify: false, decide: false, contribute: false, cancel: false };
    }
    return {
      modify: canModifyRequest(request, user),
      decide: canDecideRequest(request, user, this.requester.value()?.managerId),
      contribute: canCommentOnRequest(request, user),
      cancel: canCancelRequest(request, user, todayIso()),
    };
  });

  protected readonly back = computed(() => {
    const isOwn = this.request.value()?.userId === this.auth.user()?.id;
    return isOwn || this.auth.hasRole('Employee')
      ? { link: '/leave', label: 'My leave' }
      : { link: '/approvals', label: 'Approvals' };
  });

  protected approve(request: LeaveRequest): void {
    void this.decide(this.decisions.approve(request));
  }

  protected reject(request: LeaveRequest): void {
    void this.decide(this.decisions.reject(request));
  }

  protected async cancelRequest(request: LeaveRequest): Promise<void> {
    const approved = request.status === 'Approval';
    const confirmed = await this.confirm.confirm({
      title: 'Cancel this leave?',
      message: approved
        ? 'The approved leave is cancelled and its days go back to your balance. Your manager can see the cancellation in the request history.'
        : 'The request is withdrawn before your manager decides on it.',
      confirmLabel: 'Cancel leave',
      tone: 'danger',
    });
    if (!confirmed) return;
    this.busy.set(true);
    this.api
      .update(request.id, { status: 'Cancelled' })
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (updated) => {
          this.request.set(updated);
          this.historyVersion.update((v) => v + 1);
          this.toast.success('Leave cancelled.');
        },
        error: (err: unknown) => this.toast.error(toApiError(err).message),
      });
  }

  private async decide(decision: Promise<LeaveRequest | null>): Promise<void> {
    this.busy.set(true);
    const updated = await decision;
    this.busy.set(false);
    if (updated) {
      this.request.set(updated);
      this.historyVersion.update((v) => v + 1);
      this.pendingApprovals.refresh();
    }
  }
}
