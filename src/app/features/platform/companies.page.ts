import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Company } from '../../core/api/models';
import { CompanyApi } from '../../core/api/resources';
import { FormDialogService } from '../../shared/ui/dialogs';
import { EmptyState, LoadError, SkeletonRows } from '../../shared/ui/feedback';
import { Icon } from '../../shared/ui/icon';
import { NameDialog, NameDialogData } from '../../shared/ui/name-dialog';
import { PageHeader } from '../../shared/ui/page-header';
import { Pagination } from '../../shared/ui/pagination';
import { ToastService } from '../../shared/ui/toast';
import { TimestampPipe } from '../../shared/util/format';
import { parsePage } from '../../shared/util/query';

@Component({
  selector: 'app-companies-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, Pagination, EmptyState, LoadError, SkeletonRows, Icon, TimestampPipe],
  template: `
    <div class="page page--narrow">
      <app-page-header title="Companies" description="All companies on the platform.">
        <button type="button" class="btn btn--primary" (click)="create()">
          <app-icon name="plus" />
          New company
        </button>
      </app-page-header>

      <p class="text-secondary note">
        A new company is created without any users. The backend has no way yet to add the first Hr
        account to another company through the app, so it has to be added in the database.
      </p>

      @if (companies.error(); as error) {
        <app-load-error [error]="error" (retry)="companies.reload()" />
      } @else if (companies.hasValue() && companies.value().data.length === 0) {
        <app-empty-state icon="building" title="No companies" />
      } @else {
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th scope="col" class="num">ID</th>
                <th scope="col">Name</th>
                <th scope="col">Created</th>
              </tr>
            </thead>
            @if (companies.hasValue()) {
              <tbody>
                @for (c of companies.value().data; track c.id) {
                  <tr>
                    <td class="num">{{ c.id }}</td>
                    <td>{{ c.name }}</td>
                    <td class="text-secondary">{{ c.createdAt | timestamp }}</td>
                  </tr>
                }
              </tbody>
            } @else {
              <tbody appSkeletonRows columns="3"></tbody>
            }
          </table>
        </div>
        <app-pagination [meta]="companies.value()?.meta" (pageChange)="goToPage($event)" />
      }
    </div>
  `,
  styles: `
    .note {
      margin-bottom: var(--space-4);
    }
  `,
})
export default class CompaniesPage {
  private readonly api = inject(CompanyApi);
  private readonly dialogs = inject(FormDialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly page = input<string>();

  protected readonly companies = rxResource({
    params: () => parsePage(this.page()),
    stream: ({ params: page }) => this.api.listAll({ page }),
  });

  protected async create(): Promise<void> {
    const created = await this.dialogs.open<Company, NameDialogData<Company>>(
      NameDialog,
      {
        title: 'New company',
        label: 'Company name',
        submitLabel: 'Create',
        save: (name) => this.api.create(name),
      },
      'name-dialog-title',
    );
    if (created) {
      this.toast.success(`Company "${created.name}" was created.`);
      this.companies.reload();
    }
  }

  protected goToPage(page: number): void {
    void this.router.navigate([], { queryParams: { page } });
  }
}
