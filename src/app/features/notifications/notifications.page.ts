import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { toApiError } from '../../core/api/api-error';
import { AppNotification, NotificationType } from '../../core/api/models';
import { NotificationsApi } from '../../core/api/resources';
import { UnreadNotificationsService } from '../../core/unread-notifications.service';
import { EmptyState, LoadError } from '../../shared/ui/feedback';
import { Icon } from '../../shared/ui/icon';
import { PageHeader } from '../../shared/ui/page-header';
import { Pagination } from '../../shared/ui/pagination';
import { ToastService } from '../../shared/ui/toast';
import { TimestampPipe } from '../../shared/util/format';
import { parsePage } from '../../shared/util/query';

const TYPE_LABELS: Record<NotificationType, string> = {
  LeaveRequestSubmitted: 'New request',
  LeaveRequestApproved: 'Approved',
  LeaveRequestRejected: 'Rejected',
  General: 'Notice',
};

@Component({
  selector: 'app-notifications-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, Pagination, EmptyState, LoadError, Icon, TimestampPipe],
  templateUrl: './notifications.page.html',
  styleUrl: './notifications.page.scss',
})
export default class NotificationsPage {
  private readonly api = inject(NotificationsApi);
  private readonly unread = inject(UnreadNotificationsService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly page = input<string>();
  readonly filter = input<string>();

  protected readonly unreadOnly = computed(() => this.filter() === 'unread');
  protected readonly typeLabels = TYPE_LABELS;

  protected readonly notifications = rxResource({
    params: () => ({ page: parsePage(this.page()), isRead: this.unreadOnly() ? false : undefined }),
    stream: ({ params }) => this.api.list(params),
  });

  protected setUnreadOnly(unreadOnly: boolean): void {
    void this.router.navigate([], {
      queryParams: { filter: unreadOnly ? 'unread' : null, page: null },
    });
  }

  protected goToPage(page: number): void {
    void this.router.navigate([], { queryParams: { page }, queryParamsHandling: 'merge' });
  }

  protected markRead(notification: AppNotification): void {
    this.api.markRead(notification.id).subscribe({
      next: (updated) => {
        this.notifications.update(
          (res) =>
            res && { ...res, data: res.data.map((n) => (n.id === updated.id ? updated : n)) },
        );
        this.unread.refresh();
      },
      error: (err: unknown) => this.toast.error(toApiError(err).message),
    });
  }

  protected remove(notification: AppNotification): void {
    this.api.remove(notification.id).subscribe({
      next: () => {
        this.notifications.reload();
        this.unread.refresh();
      },
      error: (err: unknown) => this.toast.error(toApiError(err).message),
    });
  }
}
