import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { apiUrl } from '../api/http';
import { Role } from '../api/models';
import { AuthService } from './auth.service';
import { authGuard, platformAdminGuard, roleGuard } from './guards';

describe('guards', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  function signIn(role: Role, companyId = 7): void {
    TestBed.inject(AuthService).login('a@b.rs', 'x').subscribe();
    TestBed.inject(HttpTestingController)
      .expectOne(apiUrl('/auth/login'))
      .flush({ token: 't', user: { id: 1, role, companyId, firstName: 'A', lastName: 'B' } });
  }

  function run(guard: typeof authGuard, url = '/requests'): boolean | UrlTree {
    return TestBed.runInInjectionContext(
      () =>
        guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot) as boolean | UrlTree,
    );
  }

  function serialize(result: boolean | UrlTree): string | boolean {
    return result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result) : result;
  }

  it('authGuard sends a signed-out user to sign in and remembers where they were going', () => {
    expect(serialize(run(authGuard, '/approvals?status=all'))).toBe(
      '/login?returnUrl=%2Fapprovals%3Fstatus%3Dall',
    );
  });

  it('authGuard lets a signed-in user through', () => {
    signIn('Employee');
    expect(run(authGuard)).toBe(true);
  });

  it('roleGuard rejects a role that is not listed', () => {
    signIn('Employee');
    expect(serialize(run(roleGuard('Manager', 'Hr')))).toBe('/forbidden');
  });

  it('roleGuard lets a listed role through', () => {
    signIn('Manager');
    expect(run(roleGuard('Manager', 'Hr'))).toBe(true);
  });

  it('platformAdminGuard requires the Hr role in the platform company (id 1)', () => {
    signIn('Hr', 7);
    expect(serialize(run(platformAdminGuard))).toBe('/forbidden');
  });

  it('platformAdminGuard lets Hr from the platform company through', () => {
    signIn('Hr', 1);
    expect(run(platformAdminGuard)).toBe(true);
  });
});
