import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Auth Guard - štiti rute od neautentifikovanih korisnika
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Redirect na login ako nije autentifikovan
  router.navigate(['/login'], {
    queryParams: { returnUrl: state.url }
  });
  return false;
};