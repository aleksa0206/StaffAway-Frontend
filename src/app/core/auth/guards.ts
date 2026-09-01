import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Role } from '../api/models';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  return (
    auth.isAuthenticated() ||
    inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } })
  );
};

export const guestGuard: CanActivateFn = () =>
  !inject(AuthService).isAuthenticated() || inject(Router).createUrlTree(['/']);

// Guards only hide screens; the backend does the actual enforcement (403).
export function roleGuard(...roles: Role[]): CanActivateFn {
  return () =>
    inject(AuthService).hasRole(...roles) || inject(Router).createUrlTree(['/forbidden']);
}

export const platformAdminGuard: CanActivateFn = () =>
  inject(AuthService).isPlatformAdmin() || inject(Router).createUrlTree(['/forbidden']);
