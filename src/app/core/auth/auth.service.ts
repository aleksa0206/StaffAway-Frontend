import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  catchError,
  finalize,
  firstValueFrom,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { apiUrl } from '../api/http';
import { CurrentUser, Role, User } from '../api/models';

/** The company with this id is the "platform": its Hr manages the company list (backend PLATFORM_COMPANY_ID). */
const PLATFORM_COMPANY_ID = 1;

interface TokenResponse {
  token: string;
}

interface LoginResponse extends TokenResponse {
  user: User;
}

export type LoginOutcome =
  { status: 'authenticated' } | { status: 'twoFactorRequired'; tempToken: string };

// The refresh token is an httpOnly cookie scoped to /auth; it is only sent with withCredentials,
// and only to the endpoints that read or set it.
const WITH_COOKIE = { withCredentials: true } as const;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  // The access token deliberately lives only in memory: after a page reload the session is
  // restored via the refresh cookie, and the token never touches localStorage (XSS).
  private readonly accessToken = signal<string | null>(null);
  private readonly currentUser = signal<CurrentUser | null>(null);
  private refreshInFlight: Observable<string> | null = null;

  readonly user = this.currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly isPlatformAdmin = computed(() => {
    const user = this.currentUser();
    return user?.role === 'Hr' && user.companyId === PLATFORM_COMPANY_ID;
  });

  token(): string | null {
    return this.accessToken();
  }

  hasRole(...roles: Role[]): boolean {
    const role = this.currentUser()?.role;
    return role !== undefined && roles.includes(role);
  }

  login(email: string, password: string): Observable<LoginOutcome> {
    return this.http
      .post<LoginResponse>(apiUrl('/auth/login'), { email, password }, WITH_COOKIE)
      .pipe(
        tap((res) => this.startSession(res.token, { ...res.user, twoFactorEnabled: false })),
        map((): LoginOutcome => ({ status: 'authenticated' })),
        catchError((error: unknown) => {
          const tempToken = twoFactorTempToken(error);
          return tempToken
            ? of<LoginOutcome>({ status: 'twoFactorRequired', tempToken })
            : throwError(() => error);
        }),
      );
  }

  verifyTwoFactorLogin(tempToken: string, code: string): Observable<void> {
    return this.http
      .post<LoginResponse>(apiUrl('/auth/2fa/verify-login'), { tempToken, code }, WITH_COOKIE)
      .pipe(map((res) => this.startSession(res.token, { ...res.user, twoFactorEnabled: true })));
  }

  /** Called once on app start; failure only means the user is not signed in. */
  restoreSession(): Promise<void> {
    return firstValueFrom(
      this.refreshAccessToken().pipe(
        switchMap(() => this.reloadCurrentUser()),
        map(() => undefined),
        catchError(() => {
          this.clearSession();
          return of(undefined);
        }),
      ),
    );
  }

  /**
   * The backend rotates the refresh token atomically, so a second concurrent refresh with the
   * same cookie would fail. All parallel 401 responses therefore wait for the same request.
   */
  refreshAccessToken(): Observable<string> {
    this.refreshInFlight ??= this.http
      .post<TokenResponse>(apiUrl('/auth/refresh'), null, WITH_COOKIE)
      .pipe(
        map((res) => res.token),
        tap((token) => this.accessToken.set(token)),
        finalize(() => (this.refreshInFlight = null)),
        shareReplay(1),
      );
    return this.refreshInFlight;
  }

  reloadCurrentUser(): Observable<CurrentUser> {
    return this.http
      .get<CurrentUser>(apiUrl('/auth/me'))
      .pipe(tap((user) => this.currentUser.set(user)));
  }

  logout(): void {
    this.http
      .post<void>(apiUrl('/auth/logout'), null, WITH_COOKIE)
      .pipe(catchError(() => of(undefined)))
      .subscribe(() => {
        this.clearSession();
        void this.router.navigate(['/login']);
      });
  }

  /** Ends the session locally (e.g. when refresh fails); the server-side token is already invalid. */
  expireSession(returnUrl: string): void {
    this.clearSession();
    void this.router.navigate(['/login'], { queryParams: { returnUrl, expired: 1 } });
  }

  requestPasswordReset(email: string): Observable<void> {
    return this.http.post<void>(apiUrl('/auth/forgot-password'), { email });
  }

  resetPassword(token: string, newPassword: string): Observable<void> {
    return this.http.post<void>(apiUrl('/auth/reset-password'), { token, newPassword });
  }

  setupTwoFactor(): Observable<{ qrCode: string }> {
    return this.http.post<{ qrCode: string }>(apiUrl('/auth/2fa/setup'), null);
  }

  confirmTwoFactor(code: string): Observable<void> {
    return this.http
      .post<void>(apiUrl('/auth/2fa/confirm'), { code })
      .pipe(tap(() => this.patchCurrentUser({ twoFactorEnabled: true })));
  }

  disableTwoFactor(code: string): Observable<void> {
    return this.http
      .delete<void>(apiUrl('/auth/2fa'), { body: { code } })
      .pipe(tap(() => this.patchCurrentUser({ twoFactorEnabled: false })));
  }

  patchCurrentUser(changes: Partial<CurrentUser>): void {
    this.currentUser.update((user) => (user ? { ...user, ...changes } : user));
  }

  private startSession(token: string, user: CurrentUser): void {
    this.accessToken.set(token);
    this.currentUser.set(user);
  }

  private clearSession(): void {
    this.accessToken.set(null);
    this.currentUser.set(null);
  }
}

function twoFactorTempToken(error: unknown): string | null {
  if (error instanceof HttpErrorResponse && error.status === 401) {
    const body: unknown = error.error;
    if (
      typeof body === 'object' &&
      body !== null &&
      Reflect.get(body, 'twoFactorRequired') === true
    ) {
      const tempToken: unknown = Reflect.get(body, 'tempToken');
      return typeof tempToken === 'string' ? tempToken : null;
    }
  }
  return null;
}
