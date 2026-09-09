import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { catchError, filter, of } from 'rxjs';
import { CompanyApi } from '../core/api/resources';
import { AuthService } from '../core/auth/auth.service';
import { PendingApprovalsService } from '../core/pending-approvals.service';
import { UnreadNotificationsService } from '../core/unread-notifications.service';
import { Avatar } from '../shared/ui/avatar';
import { Icon, IconName } from '../shared/ui/icon';
import { FullNamePipe } from '../shared/util/format';

type Badge = 'approvals';

interface NavItem {
  label: string;
  path: string;
  icon: IconName;
  exact?: boolean;
  badge?: Badge;
  visible: (auth: AuthService) => boolean;
}

interface NavSection {
  label: string | null;
  items: NavItem[];
}

const everyone = () => true;
const managerOrHr = (auth: AuthService) => auth.hasRole('Manager', 'Hr');
const hrOnly = (auth: AuthService) => auth.hasRole('Hr');

// Navigation only shows what the backend allows for the given role.
const NAV: NavSection[] = [
  {
    label: null,
    items: [
      { label: 'Home', path: '/', icon: 'home', exact: true, visible: everyone },
      { label: 'My leave', path: '/leave', icon: 'plane', visible: everyone },
      { label: 'Team calendar', path: '/calendar', icon: 'calendar', visible: everyone },
      {
        label: 'Approvals',
        path: '/approvals',
        icon: 'approvals',
        badge: 'approvals',
        visible: managerOrHr,
      },
    ],
  },
  {
    label: 'Organization',
    items: [
      { label: 'People', path: '/people', icon: 'users', visible: managerOrHr },
      { label: 'Audit log', path: '/admin/audit-log', icon: 'history', visible: managerOrHr },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Leave policies', path: '/admin/leave-policies', icon: 'layers', visible: hrOnly },
      { label: 'Departments', path: '/admin/departments', icon: 'building', visible: hrOnly },
      { label: 'Company', path: '/admin/company', icon: 'settings', visible: hrOnly },
    ],
  },
  {
    label: 'Platform',
    items: [
      {
        label: 'Companies',
        path: '/platform/companies',
        icon: 'building',
        visible: (a) => a.isPlatformAdmin(),
      },
    ],
  },
];

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    CdkMenu,
    CdkMenuItem,
    CdkMenuTrigger,
    Icon,
    Avatar,
    FullNamePipe,
  ],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  private readonly companyApi = inject(CompanyApi);
  protected readonly auth = inject(AuthService);
  protected readonly unread = inject(UnreadNotificationsService);
  protected readonly approvals = inject(PendingApprovalsService);
  protected readonly navOpen = signal(false);

  // The company name frames the whole app; a failure here must not break the shell.
  protected readonly company = rxResource({
    stream: () => this.companyApi.getMine().pipe(catchError(() => of(null))),
  });

  protected readonly sections = computed(() => {
    // Depends on the user: the menu is recomputed when the role changes.
    this.auth.user();
    return NAV.map((section) => ({
      ...section,
      items: section.items.filter((item) => item.visible(this.auth)),
    })).filter((section) => section.items.length > 0);
  });

  protected badgeCount(badge: Badge | undefined): number {
    return badge === 'approvals' ? this.approvals.count() : 0;
  }

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.unread.start(destroyRef);
    this.approvals.start(destroyRef);
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(() => this.navOpen.set(false));
  }
}
