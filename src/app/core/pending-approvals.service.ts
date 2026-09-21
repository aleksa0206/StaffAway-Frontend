import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, map, of, Subject, switchMap } from 'rxjs';
import { LeaveRequestsApi } from './api/resources';
import { AuthService } from './auth/auth.service';
import { pollTriggers } from './polling';

const POLL_INTERVAL_MS = 60_000;

/**
 * Number of requests waiting for the current user's decision, for the navigation badge:
 * a Manager's direct reports, or the whole company for Hr. Refreshed like the notification count.
 */
@Injectable({ providedIn: 'root' })
export class PendingApprovalsService {
  private readonly api = inject(LeaveRequestsApi);
  private readonly auth = inject(AuthService);
  private readonly refresh$ = new Subject<void>();
  readonly count = signal(0);

  start(destroyRef: DestroyRef): void {
    pollTriggers(POLL_INTERVAL_MS, this.refresh$)
      .pipe(
        switchMap(() => {
          const user = this.auth.user();
          if (!user || user.role === 'Employee') return of(0);
          return this.api
            .list({
              status: 'Pending',
              managerId: user.role === 'Manager' ? user.id : undefined,
              limit: 1,
            })
            .pipe(
              map((res) => res.meta.total),
              catchError(() => of(this.count())),
            );
        }),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((count) => this.count.set(count));
  }

  refresh(): void {
    this.refresh$.next();
  }
}
