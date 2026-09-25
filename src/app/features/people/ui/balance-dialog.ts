import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { toApiError } from '../../../core/api/api-error';
import { LeaveBalance } from '../../../core/api/models';
import { LeaveBalancesApi, LeaveTypesApi } from '../../../core/api/resources';
import { FieldControl, FormField } from '../../../shared/ui/form-field';
import { applyServerErrors } from '../../../shared/util/forms';

export interface BalanceDialogData {
  userId: number;
  /** Without this the dialog creates a new balance. */
  balance?: LeaveBalance;
}

@Component({
  selector: 'app-balance-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FormField, FieldControl],
  host: { class: 'dialog' },
  template: `
    <h2 class="dialog__title" id="balance-dialog-title">
      {{ data.balance ? 'Edit balance' : 'New balance' }}
    </h2>
    @if (data.balance; as b) {
      <p class="dialog__body text-secondary">{{ b.leaveType.name }}, {{ b.year }}.</p>
    }
    <form class="dialog__form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      @if (error(); as message) {
        <p class="form-error" role="alert">{{ message }}</p>
      }
      @if (!data.balance) {
        <div class="form__row">
          <app-field label="Leave type">
            <select class="select" appFieldControl formControlName="leaveTypeId">
              <option [ngValue]="0" disabled>Select a type</option>
              @for (t of leaveTypes.value(); track t.id) {
                <option [ngValue]="t.id">{{ t.name }}</option>
              }
            </select>
          </app-field>
          <app-field label="Year">
            <input
              class="input"
              appFieldControl
              type="number"
              formControlName="year"
              min="2000"
              max="2100"
            />
          </app-field>
        </div>
      }
      <div class="form__row">
        <app-field label="Total days">
          <input class="input" appFieldControl type="number" formControlName="totalDays" min="0" />
        </app-field>
        <app-field label="Used days" hint="Approved requests update this automatically.">
          <input class="input" appFieldControl type="number" formControlName="usedDays" min="0" />
        </app-field>
      </div>
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
export class BalanceDialog {
  protected readonly data = inject<BalanceDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<LeaveBalance>>(DialogRef);
  private readonly api = inject(LeaveBalancesApi);
  private readonly leaveTypesApi = inject(LeaveTypesApi);

  protected readonly leaveTypes = rxResource({ stream: () => this.leaveTypesApi.listAll() });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    leaveTypeId: [0, Validators.min(1)],
    year: [
      new Date().getFullYear(),
      [Validators.required, Validators.min(2000), Validators.max(2100)],
    ],
    totalDays: [this.data.balance?.totalDays ?? 20, [Validators.required, Validators.min(0)]],
    usedDays: [this.data.balance?.usedDays ?? 0, [Validators.required, Validators.min(0)]],
  });

  constructor() {
    if (this.data.balance) {
      this.form.controls.leaveTypeId.disable();
      this.form.controls.year.disable();
    }
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { leaveTypeId, year, totalDays, usedDays } = this.form.getRawValue();
    const balance = this.data.balance;
    const save$ = balance
      ? this.api.update(balance.id, { totalDays, usedDays })
      : this.api.create({ userId: this.data.userId, leaveTypeId, year, totalDays, usedDays });

    this.saving.set(true);
    this.error.set(null);
    save$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (saved) => this.ref.close(saved),
      error: (err: unknown) => {
        const apiError = toApiError(err);
        if (!applyServerErrors(this.form, apiError)) {
          this.error.set(
            apiError.kind === 'conflict'
              ? 'A balance for this type and year already exists. Edit the existing one.'
              : apiError.message,
          );
        }
      },
    });
  }
}
