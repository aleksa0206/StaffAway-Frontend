import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of, Subject, switchMap } from 'rxjs';
import { NotificationsApi } from './api/resources';
import { pollTriggers } from './polling';

const POLL_INTERVAL_MS = 60_000;

/**
 * Unread notification count for the navigation badge. The backend has no WebSocket, so the
 * count is polled (see `pollTriggers`) and refreshed right after a change.
 */
@Injectable({ providedIn: 'root' })
export class UnreadNotificationsService {
  private readonly api = inject(NotificationsApi);
  private readonly refresh$ = new Subject<void>();
  readonly count = signal(0);

  /** Keeps refreshing while `destroyRef` (the shell) is alive. */
  start(destroyRef: DestroyRef): void {
    pollTriggers(POLL_INTERVAL_MS, this.refresh$)
      .pipe(
        switchMap(() => this.api.unreadCount().pipe(catchError(() => of(this.count())))),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((count) => this.count.set(count));
  }

  refresh(): void {
    this.refresh$.next();
  }
}
