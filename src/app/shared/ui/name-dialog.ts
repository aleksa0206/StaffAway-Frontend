import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, Observable } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { FieldControl, FormField } from './form-field';

export interface NameDialogData<T> {
  title: string;
  label: string;
  submitLabel: string;
  initialValue?: string;
  hint?: string;
  save: (name: string) => Observable<T>;
}

/** Dialog for entities that only have a name (department, company, API key). */
@Component({
  selector: 'app-name-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FormField, FieldControl],
  host: { class: 'dialog' },
  template: `
    <h2 class="dialog__title" id="name-dialog-title">{{ data.title }}</h2>
    <form class="dialog__form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      @if (error(); as message) {
        <p class="form-error" role="alert">{{ message }}</p>
      }
      <app-field [label]="data.label" [hint]="data.hint">
        <input
          class="input"
          appFieldControl
          formControlName="name"
          maxlength="255"
          cdkFocusInitial
        />
      </app-field>
      <div class="dialog__actions">
        <button type="button" class="btn" (click)="ref.close()">Cancel</button>
        <button
          type="submit"
          class="btn btn--primary"
          [disabled]="saving()"
          [attr.aria-busy]="saving()"
        >
          {{ data.submitLabel }}
        </button>
      </div>
    </form>
  `,
})
export class NameDialog<T> {
  protected readonly data = inject<NameDialogData<T>>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<T>>(DialogRef);

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [this.data.initialValue ?? '', [Validators.required, Validators.maxLength(255)]],
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    const name = this.form.getRawValue().name.trim();
    if (!name) {
      this.form.controls.name.setErrors({ required: true });
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.data
      .save(name)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (saved) => this.ref.close(saved),
        error: (err: unknown) => this.error.set(toApiError(err).message),
      });
  }
}
