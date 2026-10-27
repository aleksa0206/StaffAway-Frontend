import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { FieldControl, FormField } from '../../shared/ui/form-field';
import { applyServerErrors } from '../../shared/util/forms';

@Component({
  selector: 'app-register-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, FormField, FieldControl],
  styleUrl: './auth-pages.scss',
  template: `
    <h1>Create your organization</h1>

    @if (sentTo(); as email) {
      <p class="auth-notice" role="status">
        We've sent an activation link to {{ email }}. Open it to finish setting up your
        organization. The link is valid for 24 hours.
      </p>
      <p class="auth-footer"><a routerLink="/verify-email">Didn't get the email?</a></p>
    } @else {
      <p class="text-secondary auth-lead">
        You'll be its first Hr user and can invite your team afterwards.
      </p>

      @if (error(); as message) {
        <p class="form-error" role="alert">{{ message }}</p>
      }

      <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <app-field label="Organization name">
          <input
            class="input"
            appFieldControl
            formControlName="companyName"
            autocomplete="organization"
          />
        </app-field>
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
        <app-field label="Email">
          <input
            class="input"
            appFieldControl
            type="email"
            formControlName="email"
            autocomplete="email"
          />
        </app-field>
        <app-field label="Password" hint="At least 8 characters.">
          <input
            class="input"
            appFieldControl
            type="password"
            formControlName="password"
            autocomplete="new-password"
          />
        </app-field>
        <button
          type="submit"
          class="btn btn--primary auth-submit"
          [disabled]="submitting()"
          [attr.aria-busy]="submitting()"
        >
          @if (submitting()) {
            <span class="spinner" aria-hidden="true"></span>
          }
          Create organization
        </button>
      </form>

      <p class="auth-footer">Already have an account? <a routerLink="/login">Sign in</a></p>
    }
  `,
})
export default class RegisterPage {
  private readonly auth = inject(AuthService);

  protected readonly form = inject(NonNullableFormBuilder).group({
    companyName: ['', [Validators.required, Validators.maxLength(255)]],
    firstName: ['', [Validators.required, Validators.maxLength(255)]],
    lastName: ['', [Validators.required, Validators.maxLength(255)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(100)]],
  });
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly sentTo = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.auth
      .register(this.form.getRawValue())
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => this.sentTo.set(this.form.getRawValue().email),
        error: (err: unknown) => {
          const apiError = toApiError(err);
          if (!applyServerErrors(this.form, apiError)) {
            this.error.set(apiError.message);
          }
        },
      });
  }
}
