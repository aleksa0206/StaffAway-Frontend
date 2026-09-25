import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { Holiday } from '../../core/api/models';
import { HolidaysApi } from '../../core/api/resources';
import { ConfirmService } from '../../shared/ui/confirm-dialog';
import { FormDialogService } from '../../shared/ui/dialogs';
import { EmptyState, LoadError, SkeletonRows } from '../../shared/ui/feedback';
import { FieldControl, FormField } from '../../shared/ui/form-field';
import { Icon } from '../../shared/ui/icon';
import { ToastService } from '../../shared/ui/toast';
import { CalendarDatePipe, formatCalendar, toDateInputValue } from '../../shared/util/format';

@Component({
  selector: 'app-holiday-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FormField, FieldControl],
  host: { class: 'dialog' },
  template: `
    <h2 class="dialog__title" id="holiday-dialog-title">
      {{ data ? 'Edit holiday' : 'New holiday' }}
    </h2>
    <form class="dialog__form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      @if (error(); as message) {
        <p class="form-error" role="alert">{{ message }}</p>
      }
      <app-field label="Name">
        <input class="input" appFieldControl formControlName="name" maxlength="255" />
      </app-field>
      <app-field label="Date">
        <input class="input" appFieldControl type="date" formControlName="date" />
      </app-field>
      <label class="checkbox">
        <input type="checkbox" formControlName="isRecurring" />
        Repeats every year on the same date
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
export class HolidayDialog {
  protected readonly data = inject<Holiday | null>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<Holiday>>(DialogRef);
  private readonly api = inject(HolidaysApi);

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [this.data?.name ?? '', [Validators.required, Validators.maxLength(255)]],
    date: [this.data ? toDateInputValue(this.data.date) : '', Validators.required],
    isRecurring: [this.data?.isRecurring ?? false],
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
  selector: 'app-holidays-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyState, LoadError, SkeletonRows, Icon, CalendarDatePipe],
  template: `
    <section class="panel" aria-labelledby="holidays-title">
      <header class="panel__header">
        <div>
          <h2 class="panel__title" id="holidays-title">Public holidays</h2>
          <p class="text-meta">Non-working days; they are not counted in leave requests.</p>
        </div>
        <button type="button" class="btn btn--sm" (click)="edit(null)">
          <app-icon name="plus" [size]="14" />
          New holiday
        </button>
      </header>

      @if (holidays.error(); as error) {
        <app-load-error [error]="error" (retry)="holidays.reload()" />
      } @else if (holidays.value()?.length === 0) {
        <app-empty-state icon="sun" title="No holidays yet">
          <button type="button" class="btn" (click)="edit(null)">New holiday</button>
        </app-empty-state>
      } @else {
        <div class="table-wrap table-wrap--flush">
          <table class="table table--stack">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Date</th>
                <th scope="col">Repeats</th>
                <th scope="col" class="actions"><span class="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            @if (holidays.value(); as rows) {
              <tbody>
                @for (h of rows; track h.id) {
                  <tr>
                    <td data-primary>{{ h.name }}</td>
                    <td data-label="Date">
                      {{ h.isRecurring ? recurringDate(h.date) : (h.date | calendarDate) }}
                    </td>
                    <td data-label="Repeats">{{ h.isRecurring ? 'Every year' : 'Once' }}</td>
                    <td class="actions">
                      <button type="button" class="btn btn--ghost btn--sm" (click)="edit(h)">
                        Edit
                      </button>
                      <button type="button" class="btn btn--ghost btn--sm" (click)="remove(h)">
                        Delete
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            } @else {
              <tbody appSkeletonRows columns="4" rows="4"></tbody>
            }
          </table>
        </div>
      }
    </section>
  `,
})
export class HolidaysSection {
  private readonly api = inject(HolidaysApi);
  private readonly dialogs = inject(FormDialogService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly holidays = rxResource({ stream: () => this.api.listAll() });

  /** A recurring holiday's year is irrelevant, so it is shown as "25 December". */
  protected recurringDate(iso: string): string {
    return formatCalendar(iso, 'd MMMM');
  }

  protected async edit(holiday: Holiday | null): Promise<void> {
    const saved = await this.dialogs.open<Holiday, Holiday | null>(
      HolidayDialog,
      holiday,
      'holiday-dialog-title',
    );
    if (saved) this.holidays.reload();
  }

  protected async remove(holiday: Holiday): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: `Delete holiday "${holiday.name}"?`,
      message: 'Requests already submitted are not recalculated.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!confirmed) return;
    this.api.remove(holiday.id).subscribe({
      next: () => this.holidays.reload(),
      error: (err: unknown) => this.toast.error(toApiError(err).message),
    });
  }
}
