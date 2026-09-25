import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { toApiError } from '../../core/api/api-error';
import { Department } from '../../core/api/models';
import { DepartmentsApi } from '../../core/api/resources';
import { ConfirmService } from '../../shared/ui/confirm-dialog';
import { FormDialogService } from '../../shared/ui/dialogs';
import { EmptyState, LoadError, SkeletonRows } from '../../shared/ui/feedback';
import { Icon } from '../../shared/ui/icon';
import { NameDialog, NameDialogData } from '../../shared/ui/name-dialog';
import { PageHeader } from '../../shared/ui/page-header';
import { ToastService } from '../../shared/ui/toast';

@Component({
  selector: 'app-departments-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, EmptyState, LoadError, SkeletonRows, Icon],
  template: `
    <div class="page page--narrow">
      <app-page-header title="Departments" description="Used to group employees.">
        <button type="button" class="btn btn--primary" (click)="create()">
          <app-icon name="plus" />
          New department
        </button>
      </app-page-header>

      @if (departments.error(); as error) {
        <app-load-error [error]="error" (retry)="departments.reload()" />
      } @else if (departments.value()?.length === 0) {
        <app-empty-state icon="building" title="No departments yet">
          <button type="button" class="btn" (click)="create()">New department</button>
        </app-empty-state>
      } @else {
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col" class="actions"><span class="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            @if (departments.value(); as rows) {
              <tbody>
                @for (d of rows; track d.id) {
                  <tr>
                    <td>{{ d.name }}</td>
                    <td class="actions">
                      <button type="button" class="btn btn--ghost btn--sm" (click)="rename(d)">
                        Rename
                      </button>
                      <button type="button" class="btn btn--ghost btn--sm" (click)="remove(d)">
                        Delete
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            } @else {
              <tbody appSkeletonRows columns="2" rows="3"></tbody>
            }
          </table>
        </div>
      }
    </div>
  `,
})
export default class DepartmentsPage {
  private readonly api = inject(DepartmentsApi);
  private readonly dialogs = inject(FormDialogService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly departments = rxResource({ stream: () => this.api.listAll() });

  protected async create(): Promise<void> {
    const saved = await this.dialogs.open<Department, NameDialogData<Department>>(
      NameDialog,
      {
        title: 'New department',
        label: 'Name',
        submitLabel: 'Add',
        save: (name) => this.api.create(name),
      },
      'name-dialog-title',
    );
    if (saved) this.departments.reload();
  }

  protected async rename(department: Department): Promise<void> {
    const saved = await this.dialogs.open<Department, NameDialogData<Department>>(
      NameDialog,
      {
        title: 'Rename department',
        label: 'Name',
        submitLabel: 'Save',
        initialValue: department.name,
        save: (name) => this.api.update(department.id, name),
      },
      'name-dialog-title',
    );
    if (saved) this.departments.reload();
  }

  protected async remove(department: Department): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: `Delete department "${department.name}"?`,
      message: 'A department with employees cannot be deleted; move them first.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!confirmed) return;
    this.api.remove(department.id).subscribe({
      next: () => this.departments.reload(),
      error: (err: unknown) => this.toast.error(toApiError(err).message),
    });
  }
}
