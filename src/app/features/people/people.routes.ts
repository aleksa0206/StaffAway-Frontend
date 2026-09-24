import { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/guards';

export default [
  { path: '', title: 'People', loadComponent: () => import('./people-list.page') },
  {
    path: 'new',
    title: 'New employee',
    canActivate: [roleGuard('Hr')],
    loadComponent: () => import('./person-form.page'),
  },
  { path: ':id', title: 'Employee', loadComponent: () => import('./person-detail.page') },
  {
    path: ':id/edit',
    title: 'Edit employee',
    canActivate: [roleGuard('Hr')],
    loadComponent: () => import('./person-form.page'),
  },
] satisfies Routes;
