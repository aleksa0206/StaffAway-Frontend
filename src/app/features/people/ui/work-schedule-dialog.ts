import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { toApiError } from '../../../core/api/api-error';
import { WorkSchedule } from '../../../core/api/models';
import { WorkSchedulesApi } from '../../../core/api/resources';
import { FieldControl, FormField } from '../../../shared/ui/form-field';

export interface WorkScheduleDialogData {
  userId: number;
  schedule: WorkSchedule | null;
}

@Component({
  selector: 'app-work-schedule-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FormField, FieldControl],
  host: { class: 'dialog' },
  template: `
    <h2 class="dialog__title" id="schedule-dialog-title">Work schedule</h2>
    <form class="dialog__form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      @if (error(); as message) {
        <p class="form-error" role="alert">{{ message }}</p>
      }
      <app-field label="Hours per week">
        <input
          class="input"
          appFieldControl
          type="number"
          formControlName="hoursPerWeek"
          min="1"
          max="168"
        />
      </app-field>
      <label class="checkbox">
        <input type="checkbox" formControlName="isPartTime" />
        Part-time
      </label>
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
export class WorkScheduleDialog {
  protected readonly data = inject<WorkScheduleDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<WorkSchedule>>(DialogRef);
  private readonly api = inject(WorkSchedulesApi);

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    hoursPerWeek: [
      this.data.schedule?.hoursPerWeek ?? 40,
      [Validators.required, Validators.min(1), Validators.max(168)],
    ],
    isPartTime: [this.data.schedule?.isPartTime ?? false],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const body = this.form.getRawValue();
    const schedule = this.data.schedule;
    const save$ = schedule
      ? this.api.update(schedule.id, body)
      : this.api.create(this.data.userId, body);
    this.saving.set(true);
    this.error.set(null);
    save$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (saved) => this.ref.close(saved),
      error: (err: unknown) => this.error.set(toApiError(err).message),
    });
  }
}
