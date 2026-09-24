import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Role, ROLES } from '../../core/api/models';
import { DepartmentsApi, UserSort, UsersApi } from '../../core/api/resources';
import { AuthService } from '../../core/auth/auth.service';
import { Avatar } from '../../shared/ui/avatar';
import { EmptyState, LoadError, SkeletonRows } from '../../shared/ui/feedback';
import { Icon } from '../../shared/ui/icon';
import { PageHeader } from '../../shared/ui/page-header';
import { Pagination } from '../../shared/ui/pagination';
import { SearchInput } from '../../shared/ui/search-input';
import { CalendarDatePipe, FullNamePipe } from '../../shared/util/format';
import { parseOption, parsePage } from '../../shared/util/query';
import { ROLE_LABELS } from './roles';

const SORTS: readonly UserSort[] = ['name', '-name', 'hireDate', '-hireDate'];

@Component({
  selector: 'app-people-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    Avatar,
    PageHeader,
    Pagination,
    EmptyState,
    LoadError,
    SkeletonRows,
    Icon,
    SearchInput,
    CalendarDatePipe,
    FullNamePipe,
  ],
  templateUrl: './people-list.page.html',
})
export default class PeopleListPage {
  private readonly usersApi = inject(UsersApi);
  private readonly departmentsApi = inject(DepartmentsApi);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  // URL state: ?q=anna&department=3&role=Manager&sort=-hireDate&scope=all&page=2
  readonly page = input<string>();
  readonly scope = input<string>();
  readonly department = input<string>();
  readonly role = input<string>();
  readonly sort = input<string>();
  readonly q = input<string>();

  protected readonly roleLabels = ROLE_LABELS;
  protected readonly roles = ROLES.map((value) => ({ value, label: ROLE_LABELS[value] }));
  protected readonly isHr = computed(() => this.auth.hasRole('Hr'));
  /** Managers see their team by default and the whole company on request. */
  protected readonly teamOnly = computed(() => !this.isHr() && this.scope() !== 'all');
  protected readonly activeDepartment = computed(() => {
    const id = Number(this.department());
    return Number.isInteger(id) && id > 0 ? id : undefined;
  });
  protected readonly activeRole = computed(() => parseOption<Role>(this.role(), ROLES));
  protected readonly activeSort = computed(() => parseOption(this.sort(), SORTS) ?? 'name');
  protected readonly hasFilters = computed(
    () => !!(this.q() || this.activeDepartment() || this.activeRole()),
  );

  protected readonly departments = rxResource({ stream: () => this.departmentsApi.listAll() });
  protected readonly departmentNames = computed(
    () => new Map((this.departments.value() ?? []).map((d) => [d.id, d.name])),
  );

  protected readonly people = rxResource({
    params: () => ({
      page: parsePage(this.page()),
      managerId: this.teamOnly() ? this.auth.user()?.id : undefined,
      departmentId: this.activeDepartment(),
      role: this.activeRole(),
      search: this.q() || undefined,
      sort: this.activeSort(),
    }),
    stream: ({ params }) => this.usersApi.list(params),
  });

  /** `aria-sort` value for a sortable column. */
  protected ariaSort(column: 'name' | 'hireDate'): 'ascending' | 'descending' | null {
    const sort = this.activeSort();
    if (sort === column) return 'ascending';
    if (sort === `-${column}`) return 'descending';
    return null;
  }

  protected toggleSort(column: 'name' | 'hireDate'): void {
    const next = this.activeSort() === column ? `-${column}` : column;
    this.navigate({ sort: next === 'name' ? null : next });
  }

  protected setScope(all: boolean): void {
    this.navigate({ scope: all ? 'all' : null });
  }

  protected setDepartment(value: string): void {
    this.navigate({ department: value || null });
  }

  protected setRole(value: string): void {
    this.navigate({ role: value || null });
  }

  protected setSearch(q: string): void {
    this.navigate({ q: q || null });
  }

  protected clearFilters(): void {
    this.navigate({ q: null, department: null, role: null });
  }

  protected goToPage(page: number): void {
    void this.router.navigate([], { queryParams: { page }, queryParamsHandling: 'merge' });
  }

  private navigate(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], {
      queryParams: { ...queryParams, page: null },
      queryParamsHandling: 'merge',
    });
  }
}
