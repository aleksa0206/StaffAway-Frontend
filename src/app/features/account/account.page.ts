import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { UsersApi } from '../../core/api/resources';
import { AuthService } from '../../core/auth/auth.service';
import { FieldControl, FormField } from '../../shared/ui/form-field';
import { PageHeader } from '../../shared/ui/page-header';
import { ToastService } from '../../shared/ui/toast';
import { applyServerErrors } from '../../shared/util/forms';
import { TwoFactorSettings } from './two-factor-settings';

@Component({
  selector: 'app-account-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, PageHeader, FormField, FieldControl, TwoFactorSettings],
  template: `
    <div class="page page--narrow">
      <app-page-header title="My account" />

      <section class="section">
        <h2 class="section__heading">Personal details</h2>
        <form class="form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          @if (formError(); as message) {
            <p class="form-error" role="alert">{{ message }}</p>
          }
          <div class="form__row">
            <app-field label="First name">
              <input
                class="input"
                appFieldControl
                formControlName="firstName"
                autocomplete="given-name"
              />
            </app-field>
            <app-field label="Last name">
              <input
                class="input"
                appFieldControl
                formControlName="lastName"
                autocomplete="family-name"
              />
            </app-field>
          </div>
          <app-field label="Email" hint="Used to sign in.">
            <input
              class="input"
              appFieldControl
              type="email"
              formControlName="email"
              autocomplete="email"
            />
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
      </section>

      <section class="section">
        <h2 class="section__heading">Password</h2>
        <p class="text-secondary">
          The password is changed via a link sent by email: sign out and choose "Forgot your
          password?".
        </p>
      </section>

      <section class="section">
        <h2 class="section__heading">Two-factor authentication</h2>
        <app-two-factor-settings />
      </section>
    </div>
  `,
  styles: `
    .section__heading {
      margin-bottom: var(--space-3);
    }
  `,
})
export default class AccountPage {
  private readonly auth = inject(AuthService);
  private readonly usersApi = inject(UsersApi);
  private readonly toast = inject(ToastService);

  protected readonly form = inject(NonNullableFormBuilder).group({
    firstName: ['', [Validators.required, Validators.maxLength(255)]],
    lastName: ['', [Validators.required, Validators.maxLength(255)]],
    email: ['', [Validators.required, Validators.email]],
  });
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const user = this.auth.user();
      if (user && this.form.pristine) {
        this.form.reset({ firstName: user.firstName, lastName: user.lastName, email: user.email });
      }
    });
  }

  protected submit(): void {
    const user = this.auth.user();
    this.formError.set(null);
    if (!user || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    // Only personal fields are sent on purpose: manager, department and role are managed by Hr.
    const body = this.form.getRawValue();
    this.saving.set(true);
    this.usersApi
      .update(user.id, body)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updated) => {
          this.auth.patchCurrentUser(updated);
          this.form.reset(body);
          this.toast.success('Your details have been saved.');
        },
        error: (err: unknown) => {
          const apiError = toApiError(err);
          if (!applyServerErrors(this.form, apiError)) {
            this.formError.set(apiError.message);
          }
        },
      });
  }
}
