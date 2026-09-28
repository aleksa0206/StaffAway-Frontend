import { CanActivateFn, Route, Routes } from '@angular/router';
import { authGuard, guestGuard, platformAdminGuard, roleGuard } from './core/auth/guards';
import { AppShell } from './layout/app-shell';
import { AuthLayout } from './layout/auth-layout';
import { ForbiddenPage, NotFoundPage } from './layout/system-pages';

// Each auth page gets its own path with the layout. Grouping them under `path: ''` would
// also match "/" (an empty layout with no page) before the router reaches the shell.
function authPage(
  path: string,
  title: string,
  loadComponent: Route['loadComponent'],
  guards: CanActivateFn[] = [],
): Route {
  return {
    path,
    component: AuthLayout,
    canActivate: guards,
    children: [{ path: '', title, loadComponent }],
  };
}

export const routes: Routes = [
  authPage('login', 'Sign in', () => import('./features/auth/login.page'), [guestGuard]),
  authPage(
    'forgot-password',
    'Forgot password',
    () => import('./features/auth/forgot-password.page'),
    [guestGuard],
  ),
  // This path must stay as is: the backend embeds it in the email (FRONTEND_URL/reset-password?token=...).
  authPage('reset-password', 'New password', () => import('./features/auth/reset-password.page')),
  {
    path: '',
    component: AppShell,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Home',
        loadComponent: () => import('./features/home/home.page'),
      },
      {
        path: 'leave',
        title: 'My leave',
        loadComponent: () => import('./features/my-leave/my-leave.page'),
      },
      {
        path: 'requests',
        loadChildren: () => import('./features/leave-requests/leave-requests.routes'),
      },
      {
        path: 'calendar',
        title: 'Team calendar',
        loadComponent: () => import('./features/calendar/calendar.page'),
      },
      {
        path: 'approvals',
        title: 'Approvals',
        canActivate: [roleGuard('Manager', 'Hr')],
        loadComponent: () => import('./features/approvals/approvals.page'),
      },
      // Older URLs, kept so bookmarks and email links keep working.
      { path: 'balances', redirectTo: 'leave' },
      {
        path: 'notifications',
        title: 'Notifications',
        loadComponent: () => import('./features/notifications/notifications.page'),
      },
      {
        path: 'people',
        canActivate: [roleGuard('Manager', 'Hr')],
        loadChildren: () => import('./features/people/people.routes'),
      },
      {
        path: 'admin',
        loadChildren: () => import('./features/admin/admin.routes'),
      },
      {
        path: 'platform/companies',
        title: 'Companies',
        canActivate: [platformAdminGuard],
        loadComponent: () => import('./features/platform/companies.page'),
      },
      {
        path: 'account',
        title: 'My account',
        loadComponent: () => import('./features/account/account.page'),
      },
      { path: 'forbidden', title: 'Access denied', component: ForbiddenPage },
      { path: '**', title: 'Page not found', component: NotFoundPage },
    ],
  },
];
