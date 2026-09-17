import { Routes } from '@angular/router';

export default [
  // The request list now lives on "My leave".
  { path: '', pathMatch: 'full', redirectTo: '/leave' },
  {
    path: 'new',
    title: 'Request leave',
    loadComponent: () => import('./leave-request-form.page'),
  },
  {
    path: ':id',
    title: 'Leave request',
    loadComponent: () => import('./leave-request-detail.page'),
  },
  {
    path: ':id/edit',
    title: 'Edit request',
    loadComponent: () => import('./leave-request-form.page'),
  },
] satisfies Routes;
