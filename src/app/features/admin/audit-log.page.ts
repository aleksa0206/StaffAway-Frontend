import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AuditLogsApi } from '../../core/api/resources';
import { EmptyState, LoadError, SkeletonRows } from '../../shared/ui/feedback';
import { PageHeader } from '../../shared/ui/page-header';
import { Pagination } from '../../shared/ui/pagination';
import { FullNamePipe, TimestampPipe } from '../../shared/util/format';
import { parsePage } from '../../shared/util/query';

// Actions the backend records (userService, companyService); unknown ones are shown as-is.
const ACTION_LABELS: Record<string, string> = {
  ROLE_CHANGE: 'Role change',
  DELETE_USER: 'User deleted',
  UPDATE_COMPANY_NAME: 'Company renamed',
  DELETE_COMPANY: 'Company deleted',
};

@Component({
  selector: 'app-audit-log-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    Pagination,
    EmptyState,
    LoadError,
    SkeletonRows,
    FullNamePipe,
    TimestampPipe,
  ],
  template: `
    <div class="page">
      <app-page-header
        title="Audit log"
        description="Sensitive administrative changes in the company."
      />

      @if (entries.error(); as error) {
        <app-load-error [error]="error" (retry)="entries.reload()" />
      } @else if (entries.hasValue() && entries.value().data.length === 0) {
        <app-empty-state icon="history" title="No changes recorded" />
      } @else {
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Performed by</th>
                <th scope="col">Action</th>
                <th scope="col">Entity</th>
                <th scope="col">Old value</th>
                <th scope="col">New value</th>
              </tr>
            </thead>
            @if (entries.hasValue()) {
              <tbody>
                @for (e of entries.value().data; track e.id) {
                  <tr>
                    <td class="text-secondary">{{ e.createdAt | timestamp }}</td>
                    <td>{{ e.performedBy | fullName }}</td>
                    <td>{{ actionLabel(e.action) }}</td>
                    <td>{{ e.entityType }} #{{ e.entityId }}</td>
                    <td class="truncate" [title]="e.oldValue ?? ''">{{ e.oldValue ?? '—' }}</td>
                    <td class="truncate" [title]="e.newValue ?? ''">{{ e.newValue ?? '—' }}</td>
                  </tr>
                }
              </tbody>
            } @else {
              <tbody appSkeletonRows columns="6"></tbody>
            }
          </table>
        </div>
        <app-pagination [meta]="entries.value()?.meta" (pageChange)="goToPage($event)" />
      }
    </div>
  `,
})
export default class AuditLogPage {
  private readonly api = inject(AuditLogsApi);
  private readonly router = inject(Router);

  readonly page = input<string>();

  protected readonly entries = rxResource({
    params: () => parsePage(this.page()),
    stream: ({ params: page }) => this.api.list({ page }),
  });

  protected actionLabel(action: string): string {
    return ACTION_LABELS[action] ?? action;
  }

  protected goToPage(page: number): void {
    void this.router.navigate([], { queryParams: { page } });
  }
}
