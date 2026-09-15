import { CurrentUser, LeaveRequest } from '../../core/api/models';

// Mirrors the backend rules (leaveRequestService.ts). They only keep the UI from offering
// actions the server would reject; the server always has the final say.

/** Only your own pending requests can be edited or withdrawn. */
export function canModifyRequest(request: LeaveRequest, user: CurrentUser): boolean {
  return request.status === 'Pending' && request.userId === user.id;
}

/**
 * Deciding: never on your own request; a Manager only on direct reports, Hr on everyone else.
 * `requesterManagerId` is the requester's `managerId`.
 */
export function canDecideRequest(
  request: LeaveRequest,
  user: CurrentUser,
  requesterManagerId: number | null | undefined,
): boolean {
  if (
    request.userId === user.id ||
    request.status === 'Rejected' ||
    request.status === 'Cancelled'
  ) {
    return false;
  }
  if (user.role === 'Hr') {
    return true;
  }
  return user.role === 'Manager' && requesterManagerId === user.id;
}

/** The request owner or a Manager/Hr can comment. */
export function canCommentOnRequest(request: LeaveRequest, user: CurrentUser): boolean {
  return request.userId === user.id || user.role !== 'Employee';
}

/** The owner can cancel pending or approved leave until it starts; approved days go back to the balance. */
export function canCancelRequest(request: LeaveRequest, user: CurrentUser, today: string): boolean {
  return (
    request.userId === user.id &&
    (request.status === 'Pending' || request.status === 'Approval') &&
    request.startDate.slice(0, 10) > today
  );
}
