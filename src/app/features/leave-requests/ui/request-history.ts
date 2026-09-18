import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { StatusHistoryApi } from '../../../core/api/resources';
import { LoadError } from '../../../shared/ui/feedback';
import { StatusBadge } from '../../../shared/ui/status-badge';
import { FullNamePipe, TimestampPipe } from '../../../shared/util/format';

@Component({
  selector: 'app-request-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatusBadge, LoadError, FullNamePipe, TimestampPipe],
  template: `
    <h2 class="section__title">Status history</h2>
    @if (history.error(); as error) {
      <app-load-error [error]="error" (retry)="history.reload()" />
    } @else if (history.isLoading() && !history.hasValue()) {
      <span class="skeleton" style="width: 70%"></span>
    } @else if (history.value()?.length === 0) {
      <p class="text-secondary">The status hasn't changed yet.</p>
    } @else {
      <ol class="timeline">
        @for (entry of history.value(); track entry.id) {
          <li>
            <app-status-badge [status]="entry.newStatus" />
            <span class="text-secondary">{{ entry.changedBy | fullName }}</span>
            <span class="text-meta">{{ entry.changedAt | timestamp }}</span>
          </li>
        }
      </ol>
    }
  `,
  styles: `
    .section__title {
      margin-bottom: var(--space-3);
    }
    .timeline {
      display: grid;
      gap: var(--space-3);
    }
    .timeline li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-1) var(--space-2);
    }
  `,
})
export class RequestHistory {
  private readonly api = inject(StatusHistoryApi);

  readonly requestId = input.required<number>();
  /** Changes after every decision so the history reloads. */
  readonly version = input(0);

  protected readonly history = rxResource({
    params: () => ({ id: this.requestId(), version: this.version() }),
    stream: ({ params }) => this.api.listForRequest(params.id),
  });
}
