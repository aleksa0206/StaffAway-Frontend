import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin, of } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { CompanyApi } from '../../core/api/resources';
import { LoadError } from '../../shared/ui/feedback';
import { FieldControl, FormField } from '../../shared/ui/form-field';
import { PageHeader } from '../../shared/ui/page-header';
import { ToastService } from '../../shared/ui/toast';
import { applyServerErrors } from '../../shared/util/forms';
import { ApiKeysSection } from './api-keys.section';

@Component({
  selector: 'app-company-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, PageHeader, FormField, FieldControl, LoadError, ApiKeysSection],
  template: `
    <div class="page">
      <app-page-header title="Company" description="Company details and integrations." />

      <div class="stack">
        <section class="panel" aria-labelledby="company-title">
          <header class="panel__header">
            <h2 class="panel__title" id="company-title">Details</h2>
          </header>
          <div class="panel__body">
            @if (data.error(); as error) {
              <app-load-error [error]="error" (retry)="data.reload()" />
            } @else if (data.hasValue()) {
              <form class="form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
                @if (formError(); as message) {
                  <p class="form-error" role="alert">{{ message }}</p>
                }
                <app-field
                  label="Company name"
                  hint="Shown in the navigation for everyone in the company."
                >
                  <input class="input" appFieldControl formControlName="name" maxlength="255" />
                </app-field>
                <div class="form__actions">
                  <button
                    type="submit"
                    class="btn btn--primary"
                    [disabled]="saving() || form.pristine"
                    [attr.aria-busy]="saving()"
                  >
                    Save
                  </button>
                </div>
              </form>
            } @else {
              <span class="skeleton" style="width: 50%"></span>
            }
          </div>
        </section>

        <app-api-keys-section />
      </div>
    </div>
  `,
})
export default class CompanyPage {
  private readonly api = inject(CompanyApi);
  private readonly toast = inject(ToastService);

  protected readonly data = rxResource({
    stream: () => forkJoin({ company: this.api.getMine(), settings: this.api.getSettings() }),
  });

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
  });
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const company = this.data.value()?.company;
      if (company) this.form.reset({ name: company.name });
    });
  }

  protected submit(): void {
    const data = this.data.value();
    this.formError.set(null);
    if (!data || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const name = this.form.getRawValue().name.trim();
    const { settings } = data;
    // The name also lives on the company settings; keep both in sync when settings exist.
    const syncSettings$ = settings
      ? this.api.updateSettings({
          companyName: name,
          minDaysNoticeForLeave: settings.minDaysNoticeForLeave,
          defaultAnnualLeaveDays: settings.defaultAnnualLeaveDays,
          workWeekStartsMonday: settings.workWeekStartsMonday,
        })
      : of(null);

    this.saving.set(true);
    forkJoin([this.api.renameMine(name), syncSettings$])
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: ([company, updatedSettings]) => {
          this.data.set({ company, settings: updatedSettings ?? settings });
          this.form.reset({ name: company.name });
          this.toast.success(
            'Company details saved. Reload to see the new name in the navigation.',
          );
        },
        error: (err: unknown) => {
          const apiError = toApiError(err);
          if (!applyServerErrors(this.form, apiError)) this.formError.set(apiError.message);
        },
      });
  }
}
