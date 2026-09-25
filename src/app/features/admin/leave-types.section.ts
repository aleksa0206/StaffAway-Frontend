import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { LeaveType } from '../../core/api/models';
import { LeaveTypesApi } from '../../core/api/resources';
import { LeaveTypeLabel } from '../../shared/leave/leave-type-label';
import { ConfirmService } from '../../shared/ui/confirm-dialog';
import { FormDialogService } from '../../shared/ui/dialogs';
import { EmptyState, LoadError, SkeletonRows } from '../../shared/ui/feedback';
import { FieldControl, FormField } from '../../shared/ui/form-field';
import { Icon } from '../../shared/ui/icon';
import { ToastService } from '../../shared/ui/toast';

@Component({
  selector: 'app-leave-type-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FormField, FieldControl],
  host: { class: 'dialog' },
  template: `
    <h2 class="dialog__title" id="leave-type-dialog-title">
      {{ data ? 'Edit leave type' : 'New leave type' }}
    </h2>
    <form class="dialog__form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      @if (error(); as message) {
        <p class="form-error" role="alert">{{ message }}</p>
      }
      <app-field label="Name">
        <input class="input" appFieldControl formControlName="name" maxlength="255" />
      </app-field>
      <label class="checkbox">
        <input type="checkbox" formControlName="countsTowardBalance" />
        Counts toward the leave balance
      </label>
      <label class="checkbox">
        <input type="checkbox" formControlName="requiresApproval" />
        Requires manager approval
      </label>
      <p class="text-meta">
        Types that don't require approval are approved as soon as they are submitted.
      </p>
      <div class="dialog__actions">
        <button type="button" class="btn" (click)="ref.close()">Cancel</button>
        <button
          type="submit"
          class="btn btn--primary"
          [disabled]="saving()"
          [attr.aria-busy]="saving()"
        >
          Save
        </button>
      </div>
    </form>
  `,
})
export class LeaveTypeDialog {
  protected readonly data = inject<LeaveType | null>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<LeaveType>>(DialogRef);
  private readonly api = inject(LeaveTypesApi);

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [this.data?.name ?? '', [Validators.required, Validators.maxLength(255)]],
    countsTowardBalance: [this.data?.countsTowardBalance ?? true],
    requiresApproval: [this.data?.requiresApproval ?? true],
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const body = this.form.getRawValue();
    const save$ = this.data ? this.api.update(this.data.id, body) : this.api.create(body);
    this.saving.set(true);
    this.error.set(null);
    save$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (saved) => this.ref.close(saved),
      error: (err: unknown) => this.error.set(toApiError(err).message),
    });
  }
}

@Component({
  selector: 'app-leave-types-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyState, LoadError, SkeletonRows, Icon, LeaveTypeLabel],
  template: `
    <section class="panel" aria-labelledby="leave-types-title">
      <header class="panel__header">
        <div>
          <h2 class="panel__title" id="leave-types-title">Leave types</h2>
          <p class="text-meta">What employees can choose when they request leave.</p>
        </div>
        <button type="button" class="btn btn--sm" (click)="edit(null)">
          <app-icon name="plus" [size]="14" />
          New type
        </button>
      </header>

      @if (leaveTypes.error(); as error) {
        <app-load-error [error]="error" (retry)="leaveTypes.reload()" />
      } @else if (leaveTypes.value()?.length === 0) {
        <app-empty-state
          icon="tag"
          title="No leave types yet"
          description="Employees can't submit requests until at least one type exists."
        >
          <button type="button" class="btn" (click)="edit(null)">New type</button>
        </app-empty-state>
      } @else {
        <div class="table-wrap table-wrap--flush">
          <table class="table table--stack">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Balance</th>
                <th scope="col">Approval</th>
                <th scope="col" class="actions"><span class="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            @if (leaveTypes.value(); as rows) {
              <tbody>
                @for (t of rows; track t.id) {
                  <tr>
                    <td data-primary><app-leave-type [type]="t" /></td>
                    <td data-label="Balance">
                      {{ t.countsTowardBalance ? 'Counts toward balance' : 'Not counted' }}
                    </td>
                    <td data-label="Approval">
                      {{ t.requiresApproval ? 'Manager approval' : 'Automatic' }}
                    </td>
                    <td class="actions">
                      <button type="button" class="btn btn--ghost btn--sm" (click)="edit(t)">
                        Edit
                      </button>
                      <button type="button" class="btn btn--ghost btn--sm" (click)="remove(t)">
                        Delete
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            } @else {
              <tbody appSkeletonRows columns="4" rows="3"></tbody>
            }
          </table>
        </div>
        <p class="panel__footer text-meta">
          New employees automatically get a balance for every type that counts toward the balance.
          For existing employees, add the balance for a new type on their profile.
        </p>
      }
    </section>
  `,
})
export class LeaveTypesSection {
  private readonly api = inject(LeaveTypesApi);
  private readonly dialogs = inject(FormDialogService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly leaveTypes = rxResource({ stream: () => this.api.listAll() });

  protected async edit(leaveType: LeaveType | null): Promise<void> {
    const saved = await this.dialogs.open<LeaveType, LeaveType | null>(
      LeaveTypeDialog,
      leaveType,
      'leave-type-dialog-title',
    );
    if (saved) this.leaveTypes.reload();
  }

  protected async remove(leaveType: LeaveType): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: `Delete type "${leaveType.name}"?`,
      message: 'A type used in requests or balances cannot be deleted.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!confirmed) return;
    this.api.remove(leaveType.id).subscribe({
      next: () => this.leaveTypes.reload(),
      error: (err: unknown) => this.toast.error(toApiError(err).message),
    });
  }
}
