import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, of, switchMap } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { Role, ROLES } from '../../core/api/models';
import { DepartmentsApi, UsersApi } from '../../core/api/resources';
import { LoadError } from '../../shared/ui/feedback';
import { FieldControl, FormField } from '../../shared/ui/form-field';
import { PageHeader } from '../../shared/ui/page-header';
import { ToastService } from '../../shared/ui/toast';
import { fullName, toDateInputValue } from '../../shared/util/format';
import { applyServerErrors } from '../../shared/util/forms';
import { ROLE_LABELS } from './roles';

@Component({
  selector: 'app-person-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, PageHeader, FormField, FieldControl, LoadError],
  templateUrl: './person-form.page.html',
})
export default class PersonFormPage {
  private readonly usersApi = inject(UsersApi);
  private readonly departmentsApi = inject(DepartmentsApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly id = input<string>();
  protected readonly isEdit = computed(() => this.id() !== undefined);
  protected readonly roles = ROLES.map((value) => ({ value, label: ROLE_LABELS[value] }));

  protected readonly existing = rxResource({
    params: () => this.id(),
    stream: ({ params: id }) => (id ? this.usersApi.get(Number(id)) : of(null)),
  });
  protected readonly departments = rxResource({ stream: () => this.departmentsApi.listAll() });
  private readonly allUsers = rxResource({ stream: () => this.usersApi.listAll() });

  /** Anyone with the Manager or Hr role can be the manager, except the person themselves. */
  protected readonly managerOptions = computed(() =>
    (this.allUsers.value() ?? [])
      .filter((u) => u.role !== 'Employee' && String(u.id) !== this.id())
      .map((u) => ({ id: u.id, label: fullName(u) })),
  );

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group({
    firstName: ['', [Validators.required, Validators.maxLength(255)]],
    lastName: ['', [Validators.required, Validators.maxLength(255)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(100)]],
    role: this.fb.control<Role>('Employee'),
    managerId: new FormControl<number | null>(null),
    departmentId: new FormControl<number | null>(null),
    hireDate: ['', Validators.required],
  });

  protected readonly submitting = signal(false);
  protected readonly formError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const user = this.existing.value();
      if (user) {
        this.form.controls.password.disable();
        this.form.patchValue({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          managerId: user.managerId,
          departmentId: user.departmentId,
          hireDate: toDateInputValue(user.hireDate),
        });
      }
    });
  }

  protected submit(): void {
    this.formError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { password, departmentId, ...fields } = this.form.getRawValue();
    const id = this.id();

    // The backend doesn't accept a department on create, so it is set right after with an update.
    const save$ = id
      ? this.usersApi.update(Number(id), { ...fields, departmentId })
      : this.usersApi
          .create({ ...fields, password })
          .pipe(
            switchMap((created) =>
              departmentId ? this.usersApi.update(created.id, { departmentId }) : of(created),
            ),
          );

    this.submitting.set(true);
    save$.pipe(finalize(() => this.submitting.set(false))).subscribe({
      next: (saved) => {
        this.toast.success(id ? 'Changes saved.' : `${fullName(saved)} was added.`);
        void this.router.navigate(['/people', saved.id]);
      },
      error: (err: unknown) => {
        const apiError = toApiError(err);
        if (!applyServerErrors(this.form, apiError)) {
          this.formError.set(apiError.message);
        }
      },
    });
  }

  protected cancel(): void {
    const id = this.id();
    void this.router.navigate(id ? ['/people', id] : ['/people']);
  }
}
