import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { apiUrl } from './core/api/http';
import { AuthService } from './core/auth/auth.service';

describe('app routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  function signIn(): void {
    TestBed.inject(AuthService).login('a@b.rs', 'x').subscribe();
    TestBed.inject(HttpTestingController)
      .expectOne(apiUrl('/auth/login'))
      .flush({
        token: 't',
        user: { id: 1, role: 'Employee', companyId: 2, firstName: 'A', lastName: 'B' },
      });
  }

  // Regression: the auth layout grouped under `path: ''` caught "/" and showed an empty panel.
  it('"/" shows the application shell with Home for a signed-in user', async () => {
    signIn();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');
    expect(TestBed.inject(Router).url).toBe('/');
    const root = harness.fixture.nativeElement as HTMLElement;
    expect(root.querySelector('app-shell')).not.toBeNull();
    expect(root.querySelector('app-auth-layout')).toBeNull();
  });

  it('"/" takes a signed-out user to sign in', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');
    expect(TestBed.inject(Router).url).toBe('/login?returnUrl=%2F');
  });

  it('keeps old list URLs working by redirecting to "My leave"', async () => {
    signIn();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/requests');
    expect(TestBed.inject(Router).url).toBe('/leave');
    await harness.navigateByUrl('/balances');
    expect(TestBed.inject(Router).url).toBe('/leave');
  });
});
