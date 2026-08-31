import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EMPTY, expand, map, Observable, reduce } from 'rxjs';
import { apiUrl, toParams } from './http';
import {
  ApiKey,
  AppNotification,
  Attachment,
  AuditLogEntry,
  Company,
  CompanySettings,
  Department,
  Holiday,
  LeaveBalance,
  LeaveComment,
  LeaveRequest,
  LeaveStatus,
  LeaveType,
  Paged,
  Role,
  StatusHistoryEntry,
  User,
  WorkSchedule,
} from './models';

// One service per backend resource. Components never build URLs themselves.
// Services live in core/ because several features share them (e.g. leave types: request form and admin).

const MAX_PAGE_SIZE = 100;

/** For small lookup lists (types, departments, holidays) shown in selects. */
function fetchAll<T>(fetchPage: (page: number) => Observable<Paged<T>>): Observable<T[]> {
  return fetchPage(1).pipe(
    expand((res) => (res.meta.page < res.meta.totalPages ? fetchPage(res.meta.page + 1) : EMPTY)),
    reduce<Paged<T>, T[]>((all, res) => all.concat(res.data), []),
  );
}

export type PageParams = { page?: number | undefined; limit?: number | undefined };

export type LeaveRequestSort = '-createdAt' | 'startDate' | '-startDate';

export type LeaveRequestQuery = PageParams & {
  userId?: number | undefined;
  managerId?: number | undefined;
  departmentId?: number | undefined;
  status?: LeaveStatus | readonly LeaveStatus[] | undefined;
  /** `YYYY-MM-DD`; returns requests overlapping [from, to]. */
  from?: string | undefined;
  to?: string | undefined;
  sort?: LeaveRequestSort | undefined;
};

/** Statuses that mean someone is (or will be) away. */
export const ACTIVE_LEAVE_STATUSES: readonly LeaveStatus[] = ['Pending', 'Approval'];

function leaveRequestParams(query: LeaveRequestQuery) {
  const { status, ...rest } = query;
  const statuses: readonly LeaveStatus[] | undefined =
    typeof status === 'string' ? [status] : status;
  return toParams({ ...rest, status: statuses?.join(',') });
}

export type LeaveRequestInput = {
  startDate: string;
  endDate: string;
  totalDays: number;
  leaveTypeId: number;
  comment?: string;
};

export type LeaveRequestUpdate = Partial<Omit<LeaveRequestInput, 'leaveTypeId'>> & {
  status?: LeaveStatus;
};

@Injectable({ providedIn: 'root' })
export class LeaveRequestsApi {
  private readonly http = inject(HttpClient);

  list(query: LeaveRequestQuery): Observable<Paged<LeaveRequest>> {
    return this.http.get<Paged<LeaveRequest>>(apiUrl('/leave-requests'), {
      params: leaveRequestParams(query),
    });
  }
  /** Every request matching the query (e.g. one calendar month), across pages. */
  listAll(query: Omit<LeaveRequestQuery, 'page' | 'limit'>): Observable<LeaveRequest[]> {
    return fetchAll((page) => this.list({ ...query, page, limit: MAX_PAGE_SIZE }));
  }
  get(id: number): Observable<LeaveRequest> {
    return this.http.get<LeaveRequest>(apiUrl(`/leave-requests/${id}`));
  }
  create(body: LeaveRequestInput): Observable<LeaveRequest> {
    return this.http.post<LeaveRequest>(apiUrl('/leave-requests'), body);
  }
  update(id: number, body: LeaveRequestUpdate): Observable<LeaveRequest> {
    return this.http.put<LeaveRequest>(apiUrl(`/leave-requests/${id}`), body);
  }
  remove(id: number): Observable<unknown> {
    return this.http.delete(apiUrl(`/leave-requests/${id}`));
  }
}

@Injectable({ providedIn: 'root' })
export class CommentsApi {
  private readonly http = inject(HttpClient);

  listForRequest(leaveRequestId: number): Observable<LeaveComment[]> {
    return fetchAll((page) =>
      this.http.get<Paged<LeaveComment>>(apiUrl('/comments'), {
        params: toParams({ leaveRequestId, page, limit: MAX_PAGE_SIZE }),
      }),
    );
  }
  create(leaveRequestId: number, text: string): Observable<LeaveComment> {
    return this.http.post<LeaveComment>(apiUrl('/comments'), { leaveRequestId, text });
  }
  update(id: number, text: string): Observable<LeaveComment> {
    return this.http.put<LeaveComment>(apiUrl(`/comments/${id}`), { text });
  }
  remove(id: number): Observable<unknown> {
    return this.http.delete(apiUrl(`/comments/${id}`));
  }
}

@Injectable({ providedIn: 'root' })
export class AttachmentsApi {
  private readonly http = inject(HttpClient);

  listForRequest(leaveRequestId: number): Observable<Attachment[]> {
    return fetchAll((page) =>
      this.http.get<Paged<Attachment>>(apiUrl('/attachments'), {
        params: toParams({ leaveRequestId, page, limit: MAX_PAGE_SIZE }),
      }),
    );
  }
  upload(leaveRequestId: number, file: File): Observable<Attachment> {
    const body = new FormData();
    body.append('leaveRequestId', String(leaveRequestId));
    body.append('file', file);
    return this.http.post<Attachment>(apiUrl('/attachments'), body);
  }
  remove(id: number): Observable<unknown> {
    return this.http.delete(apiUrl(`/attachments/${id}`));
  }
}

@Injectable({ providedIn: 'root' })
export class StatusHistoryApi {
  private readonly http = inject(HttpClient);

  listForRequest(leaveRequestId: number): Observable<StatusHistoryEntry[]> {
    return fetchAll((page) =>
      this.http.get<Paged<StatusHistoryEntry>>(apiUrl('/status-histories'), {
        params: toParams({ leaveRequestId, page, limit: MAX_PAGE_SIZE }),
      }),
    );
  }
}

export type LeaveTypeInput = Pick<LeaveType, 'name' | 'requiresApproval' | 'countsTowardBalance'>;

@Injectable({ providedIn: 'root' })
export class LeaveTypesApi {
  private readonly http = inject(HttpClient);

  listAll(): Observable<LeaveType[]> {
    return fetchAll((page) =>
      this.http.get<Paged<LeaveType>>(apiUrl('/leave-types'), {
        params: toParams({ page, limit: MAX_PAGE_SIZE }),
      }),
    );
  }
  create(body: LeaveTypeInput): Observable<LeaveType> {
    return this.http.post<LeaveType>(apiUrl('/leave-types'), body);
  }
  update(id: number, body: LeaveTypeInput): Observable<LeaveType> {
    return this.http.put<LeaveType>(apiUrl(`/leave-types/${id}`), body);
  }
  remove(id: number): Observable<unknown> {
    return this.http.delete(apiUrl(`/leave-types/${id}`));
  }
}

export type HolidayInput = { name: string; date: string; isRecurring: boolean };

@Injectable({ providedIn: 'root' })
export class HolidaysApi {
  private readonly http = inject(HttpClient);

  listAll(): Observable<Holiday[]> {
    return fetchAll((page) =>
      this.http.get<Paged<Holiday>>(apiUrl('/holidays'), {
        params: toParams({ page, limit: MAX_PAGE_SIZE }),
      }),
    );
  }
  create(body: HolidayInput): Observable<Holiday> {
    return this.http.post<Holiday>(apiUrl('/holidays'), body);
  }
  update(id: number, body: HolidayInput): Observable<Holiday> {
    return this.http.put<Holiday>(apiUrl(`/holidays/${id}`), body);
  }
  remove(id: number): Observable<unknown> {
    return this.http.delete(apiUrl(`/holidays/${id}`));
  }
}

@Injectable({ providedIn: 'root' })
export class DepartmentsApi {
  private readonly http = inject(HttpClient);

  listAll(): Observable<Department[]> {
    return fetchAll((page) =>
      this.http.get<Paged<Department>>(apiUrl('/departments'), {
        params: toParams({ page, limit: MAX_PAGE_SIZE }),
      }),
    );
  }
  create(name: string): Observable<Department> {
    return this.http.post<Department>(apiUrl('/departments'), { name });
  }
  update(id: number, name: string): Observable<Department> {
    return this.http.put<Department>(apiUrl(`/departments/${id}`), { name });
  }
  remove(id: number): Observable<unknown> {
    return this.http.delete(apiUrl(`/departments/${id}`));
  }
}

export type UserSort = 'name' | '-name' | 'hireDate' | '-hireDate';

export type UserQuery = PageParams & {
  managerId?: number | undefined;
  departmentId?: number | undefined;
  role?: Role | undefined;
  search?: string | undefined;
  sort?: UserSort | undefined;
};

export type UserCreateInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: Role;
  managerId: number | null;
  hireDate: string;
};

export type UserUpdateInput = Partial<Omit<UserCreateInput, 'password'>> & {
  departmentId?: number | null;
};

@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly http = inject(HttpClient);

  list(query: UserQuery): Observable<Paged<User>> {
    return this.http.get<Paged<User>>(apiUrl('/users'), { params: toParams(query) });
  }
  listAll(query: Omit<UserQuery, 'page' | 'limit'> = {}): Observable<User[]> {
    return fetchAll((page) => this.list({ ...query, page, limit: MAX_PAGE_SIZE }));
  }
  get(id: number): Observable<User> {
    return this.http.get<User>(apiUrl(`/users/${id}`));
  }
  create(body: UserCreateInput): Observable<User> {
    return this.http.post<User>(apiUrl('/users'), body);
  }
  update(id: number, body: UserUpdateInput): Observable<User> {
    return this.http.put<User>(apiUrl(`/users/${id}`), body);
  }
  remove(id: number): Observable<unknown> {
    return this.http.delete(apiUrl(`/users/${id}`));
  }
}

export type LeaveBalanceInput = {
  userId: number;
  leaveTypeId: number;
  year: number;
  totalDays: number;
  usedDays: number;
};

@Injectable({ providedIn: 'root' })
export class LeaveBalancesApi {
  private readonly http = inject(HttpClient);

  listForUser(userId: number, year?: number): Observable<LeaveBalance[]> {
    return this.listForUsers([userId], year);
  }
  /** One request for a whole list page (e.g. the approvals table). */
  listForUsers(userIds: readonly number[], year?: number): Observable<LeaveBalance[]> {
    return fetchAll((page) =>
      this.http.get<Paged<LeaveBalance>>(apiUrl('/leave-balances'), {
        params: toParams({ userIds: userIds.join(','), year, page, limit: MAX_PAGE_SIZE }),
      }),
    );
  }
  create(body: LeaveBalanceInput): Observable<LeaveBalance> {
    return this.http.post<LeaveBalance>(apiUrl('/leave-balances'), body);
  }
  update(
    id: number,
    body: Pick<LeaveBalanceInput, 'totalDays' | 'usedDays'>,
  ): Observable<LeaveBalance> {
    return this.http.put<LeaveBalance>(apiUrl(`/leave-balances/${id}`), body);
  }
  remove(id: number): Observable<unknown> {
    return this.http.delete(apiUrl(`/leave-balances/${id}`));
  }
}

export type WorkScheduleInput = { hoursPerWeek: number; isPartTime: boolean };

@Injectable({ providedIn: 'root' })
export class WorkSchedulesApi {
  private readonly http = inject(HttpClient);

  /** A user has at most one schedule (userId is unique in the database). */
  getForUser(userId: number): Observable<WorkSchedule | null> {
    return this.http
      .get<Paged<WorkSchedule>>(apiUrl('/work-schedules'), { params: toParams({ userId }) })
      .pipe(map((res) => res.data[0] ?? null));
  }
  create(userId: number, body: WorkScheduleInput): Observable<WorkSchedule> {
    return this.http.post<WorkSchedule>(apiUrl('/work-schedules'), { userId, ...body });
  }
  update(id: number, body: WorkScheduleInput): Observable<WorkSchedule> {
    return this.http.put<WorkSchedule>(apiUrl(`/work-schedules/${id}`), body);
  }
  remove(id: number): Observable<unknown> {
    return this.http.delete(apiUrl(`/work-schedules/${id}`));
  }
}

export type NotificationQuery = PageParams & { isRead?: boolean | undefined };

@Injectable({ providedIn: 'root' })
export class NotificationsApi {
  private readonly http = inject(HttpClient);

  list(query: NotificationQuery): Observable<Paged<AppNotification>> {
    return this.http.get<Paged<AppNotification>>(apiUrl('/notifications'), {
      params: toParams(query),
    });
  }
  unreadCount(): Observable<number> {
    return this.list({ isRead: false, limit: 1 }).pipe(map((res) => res.meta.total));
  }
  markRead(id: number): Observable<AppNotification> {
    return this.http.put<AppNotification>(apiUrl(`/notifications/${id}`), { isRead: true });
  }
  remove(id: number): Observable<unknown> {
    return this.http.delete(apiUrl(`/notifications/${id}`));
  }
}

export type CompanySettingsInput = Omit<CompanySettings, 'id' | 'companyId'>;

@Injectable({ providedIn: 'root' })
export class CompanyApi {
  private readonly http = inject(HttpClient);

  getMine(): Observable<Company> {
    return this.http.get<Company>(apiUrl('/companies/me'));
  }
  renameMine(name: string): Observable<Company> {
    return this.http.put<Company>(apiUrl('/companies'), { name });
  }
  /** The backend returns `null` until Hr saves the settings for the first time. */
  getSettings(): Observable<CompanySettings | null> {
    return this.http.get<CompanySettings | null>(apiUrl('/settings'));
  }
  createSettings(body: CompanySettingsInput): Observable<CompanySettings> {
    return this.http.post<CompanySettings>(apiUrl('/settings'), body);
  }
  updateSettings(body: CompanySettingsInput): Observable<CompanySettings> {
    return this.http.put<CompanySettings>(apiUrl('/settings'), body);
  }
  listAll(query: PageParams): Observable<Paged<Company>> {
    return this.http.get<Paged<Company>>(apiUrl('/companies'), { params: toParams(query) });
  }
  create(name: string): Observable<Company> {
    return this.http.post<Company>(apiUrl('/companies'), { name });
  }
}

@Injectable({ providedIn: 'root' })
export class ApiKeysApi {
  private readonly http = inject(HttpClient);

  list(query: PageParams): Observable<Paged<ApiKey>> {
    return this.http.get<Paged<ApiKey>>(apiUrl('/api-keys'), { params: toParams(query) });
  }
  create(name: string): Observable<ApiKey> {
    return this.http.post<ApiKey>(apiUrl('/api-keys'), { name });
  }
  revoke(id: number): Observable<ApiKey> {
    return this.http.put<ApiKey>(apiUrl(`/api-keys/${id}/revoke`), null);
  }
  remove(id: number): Observable<unknown> {
    return this.http.delete(apiUrl(`/api-keys/${id}`));
  }
}

@Injectable({ providedIn: 'root' })
export class AuditLogsApi {
  private readonly http = inject(HttpClient);

  list(query: PageParams): Observable<Paged<AuditLogEntry>> {
    return this.http.get<Paged<AuditLogEntry>>(apiUrl('/audit-logs'), { params: toParams(query) });
  }
}
