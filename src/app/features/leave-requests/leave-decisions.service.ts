import { inject, Injectable } from '@angular/core';
import { catchError, firstValueFrom, of } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { LeaveRequest, LeaveStatus } from '../../core/api/models';
import { LeaveRequestsApi } from '../../core/api/resources';
import { ConfirmService } from '../../shared/ui/confirm-dialog';
import { ToastService } from '../../shared/ui/toast';
import { fullName } from '../../shared/util/format';

/** Approving and rejecting, shared by the request detail page and the approvals list. */
@Injectable({ providedIn: 'root' })
export class LeaveDecisionsService {
  private readonly api = inject(LeaveRequestsApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  approve(request: LeaveRequest): Promise<LeaveRequest | null> {
    return this.setStatus(request, 'Approval', `Request from ${fullName(request.user)} approved.`);
  }

  async reject(request: LeaveRequest): Promise<LeaveRequest | null> {
    const wasApproved = request.status === 'Approval';
    const confirmed = await this.confirm.confirm(
      wasApproved
        ? {
            title: 'Revoke approval?',
            message: `Leave for ${fullName(request.user)} will be marked as rejected and the used days returned to the balance. The employee will be notified.`,
            confirmLabel: 'Revoke approval',
            tone: 'danger',
          }
        : {
            title: 'Reject request?',
            message: `The request from ${fullName(request.user)} will be rejected and the employee will be notified.`,
            confirmLabel: 'Reject',
            tone: 'danger',
          },
    );
    if (!confirmed) return null;
    return this.setStatus(
      request,
      'Rejected',
      wasApproved ? 'Approval revoked.' : 'Request rejected.',
    );
  }

  private setStatus(
    request: LeaveRequest,
    status: LeaveStatus,
    successMessage: string,
  ): Promise<LeaveRequest | null> {
    return firstValueFrom(
      this.api.update(request.id, { status }).pipe(
        catchError((err: unknown) => {
          this.toast.error(toApiError(err).message);
          return of(null);
        }),
      ),
    ).then((updated) => {
      if (updated) this.toast.success(successMessage);
      return updated;
    });
  }
}
