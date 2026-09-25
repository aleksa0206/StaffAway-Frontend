import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { CompanyApi } from '../../core/api/resources';
import { LoadError } from '../../shared/ui/feedback';
import { FieldControl, FormField } from '../../shared/ui/form-field';
import { PageHeader } from '../../shared/ui/page-header';
import { ToastService } from '../../shared/ui/toast';
import { applyServerErrors } from '../../shared/util/forms';
import { HolidaysSection } from './holidays.section';
import { LeaveTypesSection } from './leave-types.section';

@Component({
  selector: 'app-leave-policies-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PageHeader,
    FormField,
    FieldControl,
    LoadError,
    LeaveTypesSection,
    HolidaysSection,
  ],
  template: `
    <div class="page">
      <app-page-header
        title="Leave policies"
        description="The rules, leave types and holidays that every request is checked against."
      />

      <div class="policies">
        <section class="panel" aria-labelledby="rules-title">
          <header class="panel__header">
            <div>
              <h2 class="panel__title" id="rules-title">Rules</h2>
              <p class="text-meta">Apply to every new request and every new employee.</p>
            </div>
          </header>
          <div class="panel__body">
            @if (data.error(); as error) {
              <app-load-error [error]="error" (retry)="data.reload()" />
            } @else if (data.hasValue()) {
              <form class="form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
                @if (!data.value().settings) {
                  <p class="alert alert--info">
                    These are the defaults; they apply until you save.
                  </p>
                }
                @if (formError(); as message) {
                  <p class="form-error" role="alert">{{ message }}</p>
                }
                <div class="form__row">
                  <app-field
                    label="Minimum notice (days)"
                    hint="How far in advance a request must be submitted."
                  >
                    <input
                      class="input"
                      appFieldControl
                      type="number"
                      min="0"
                      formControlName="minDaysNoticeForLeave"
                    />
                  </app-field>
                  <app-field
                    label="Annual entitlement (days)"
                    hint="Starting balance for new employees."
                  >
                    <input
                      class="input"
                      appFieldControl
                      type="number"
                      min="0"
                      formControlName="defaultAnnualLeaveDays"
                    />
                  </app-field>
                </div>
                <label class="checkbox">
                  <input type="checkbox" formControlName="workWeekStartsMonday" />
                  Work week starts on Monday
                </label>
                <div class="form__actions">
                  <button
                    type="submit"
                    class="btn btn--primary"
                    [disabled]="saving() || form.pristine"
                    [attr.aria-busy]="saving()"
                  >
                    @if (saving()) {
                      <span class="spinner" aria-hidden="true"></span>
                    }
                    Save rules
                  </button>
                </div>
              </form>
            } @else {
              <span class="skeleton" style="width: 60%"></span>
            }
          </div>
        </section>

        <app-leave-types-section />
        <app-holidays-section />
      </div>
    </div>
  `,
  styles: `
    .policies {
      display: grid;
      gap: var(--space-5);
    }
  `,
})
export default class LeavePoliciesPage {
  private readonly api = inject(CompanyApi);
  private readonly toast = inject(ToastService);

  protected readonly data = rxResource({
    stream: () => forkJoin({ company: this.api.getMine(), settings: this.api.getSettings() }),
  });

  protected readonly form = inject(NonNullableFormBuilder).group({
    minDaysNoticeForLeave: [1, [Validators.required, Validators.min(0)]],
    defaultAnnualLeaveDays: [20, [Validators.required, Validators.min(0)]],
    workWeekStartsMonday: [true],
  });
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const settings = this.data.value()?.settings;
      this.form.reset({
        minDaysNoticeForLeave: settings?.minDaysNoticeForLeave ?? 1,
        defaultAnnualLeaveDays: settings?.defaultAnnualLeaveDays ?? 20,
        workWeekStartsMonday: settings?.workWeekStartsMonday ?? true,
      });
    });
  }

  protected submit(): void {
    const data = this.data.value();
    this.formError.set(null);
    if (!data || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    // The backend keeps the company name on the settings too; send the current one to keep them in sync.
    const body = { ...this.form.getRawValue(), companyName: data.company.name };
    const save$ = data.settings ? this.api.updateSettings(body) : this.api.createSettings(body);
    this.saving.set(true);
    save$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (settings) => {
        this.data.set({ ...data, settings });
        this.toast.success('Rules saved.');
      },
      error: (err: unknown) => {
        const apiError = toApiError(err);
        if (!applyServerErrors(this.form, apiError)) this.formError.set(apiError.message);
      },
    });
  }
}
