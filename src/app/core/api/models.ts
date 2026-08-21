// Backend API contracts (StaffAway-Backend, prisma/schema.prisma + repositories).
// Dates arrive as ISO strings; leave dates are UTC midnight.

export type IsoDateString = string;

export const ROLES = ['Employee', 'Manager', 'Hr'] as const;
export type Role = (typeof ROLES)[number];

export const LEAVE_STATUSES = ['Pending', 'Approval', 'Rejected', 'Cancelled'] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export type NotificationType =
  'LeaveRequestSubmitted' | 'LeaveRequestApproved' | 'LeaveRequestRejected' | 'General';

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Paged<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface PageQuery {
  page?: number;
  limit?: number;
}

export interface PersonRef {
  id: number;
  firstName: string;
  lastName: string;
}

export interface User extends PersonRef {
  email: string;
  role: Role;
  managerId: number | null;
  departmentId: number | null;
  companyId: number;
  hireDate: IsoDateString;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface CurrentUser extends User {
  twoFactorEnabled: boolean;
}

export interface LeaveType {
  id: number;
  companyId: number;
  name: string;
  requiresApproval: boolean;
  countsTowardBalance: boolean;
}

export interface LeaveRequest {
  id: number;
  userId: number;
  leaveTypeId: number;
  companyId: number;
  approvedById: number | null;
  totalDays: number;
  comment: string | null;
  status: LeaveStatus;
  startDate: IsoDateString;
  endDate: IsoDateString;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  user: PersonRef;
  approvedBy: PersonRef | null;
  leaveType: { id: number; name: string };
}

export interface LeaveComment {
  id: number;
  leaveRequestId: number;
  authorId: number;
  text: string;
  createdAt: IsoDateString;
  author: PersonRef;
}

export interface Attachment {
  id: number;
  leaveRequestId: number;
  fileName: string;
  fileUrl: string;
  uploadedAt: IsoDateString;
}

export interface StatusHistoryEntry {
  id: number;
  leaveRequestId: number;
  changedAt: IsoDateString;
  oldStatus: LeaveStatus;
  newStatus: LeaveStatus;
  changedBy: PersonRef;
}

export interface LeaveBalance {
  id: number;
  userId: number;
  leaveTypeId: number;
  year: number;
  totalDays: number;
  usedDays: number;
  user: PersonRef;
  leaveType: { id: number; name: string };
}

export interface AppNotification {
  id: number;
  message: string;
  isRead: boolean;
  type: NotificationType;
  createdAt: IsoDateString;
}

export interface Department {
  id: number;
  name: string;
}

export interface Holiday {
  id: number;
  name: string;
  date: IsoDateString;
  isRecurring: boolean;
}

export interface WorkSchedule {
  id: number;
  userId: number;
  hoursPerWeek: number;
  isPartTime: boolean;
}

export interface CompanySettings {
  id: number;
  companyId: number;
  companyName: string;
  minDaysNoticeForLeave: number;
  defaultAnnualLeaveDays: number;
  workWeekStartsMonday: boolean;
}

export interface Company {
  id: number;
  name: string;
  createdAt: IsoDateString;
}

export interface ApiKey {
  id: number;
  name: string;
  key: string;
  revoked: boolean;
  createdAt: IsoDateString;
  lastUsedAt: IsoDateString | null;
}

export interface AuditLogEntry {
  id: number;
  entityType: string;
  entityId: number;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: IsoDateString;
  performedBy: PersonRef;
}
