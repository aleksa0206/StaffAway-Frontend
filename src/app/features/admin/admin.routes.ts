import { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/guards';

const hrOnly = [roleGuard('Hr')];

export default [
  {
    path: 'leave-policies',
    title: 'Leave policies',
    canActivate: hrOnly,
    loadComponent: () => import('./leave-policies.page'),
  },
  {
    path: 'departments',
    title: 'Departments',
    canActivate: hrOnly,
    loadComponent: () => import('./departments.page'),
  },
  {
    path: 'company',
    title: 'Company',
    canActivate: hrOnly,
    loadComponent: () => import('./company.page'),
  },
  {
    path: 'audit-log',
    title: 'Audit log',
    canActivate: [roleGuard('Manager', 'Hr')],
    loadComponent: () => import('./audit-log.page'),
  },
  // Older URLs, kept so bookmarks keep working.
  { path: 'leave-types', redirectTo: 'leave-policies' },
  { path: 'holidays', redirectTo: 'leave-policies' },
  { path: 'settings', redirectTo: 'company' },
  { path: 'api-keys', redirectTo: 'company' },
] satisfies Routes;
