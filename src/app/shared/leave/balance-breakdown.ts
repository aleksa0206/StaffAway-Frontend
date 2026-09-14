import { LeaveBalance, LeaveRequest } from '../../core/api/models';

export interface BalanceBreakdown {
  balanceId: number;
  leaveType: { id: number; name: string };
  year: number;
  total: number;
  /** Approved days that are already taken (started on or before today). */
  used: number;
  /** Approved days still in the future. */
  scheduled: number;
  /** Days in requests awaiting a decision. */
  pending: number;
  /** Entitlement minus everything approved; pending days are not deducted yet. */
  remaining: number;
}

/**
 * The backend's `usedDays` counts every approved day, past or future. Splitting it into "used"
 * and "scheduled" (and adding "pending") needs the requests themselves, which is why this
 * lives in the frontend. `requests` should be the balance owner's requests for the same year.
 */
export function balanceBreakdown(
  balances: readonly LeaveBalance[],
  requests: readonly LeaveRequest[],
  today: string,
): BalanceBreakdown[] {
  return balances.map((balance) => {
    const relevant = requests.filter(
      (r) =>
        r.userId === balance.userId &&
        r.leaveTypeId === balance.leaveTypeId &&
        Number(r.startDate.slice(0, 4)) === balance.year,
    );
    const sum = (predicate: (r: LeaveRequest) => boolean) =>
      relevant.filter(predicate).reduce((total, r) => total + r.totalDays, 0);

    const scheduled = Math.min(
      balance.usedDays,
      sum((r) => r.status === 'Approval' && r.startDate.slice(0, 10) > today),
    );
    return {
      balanceId: balance.id,
      leaveType: balance.leaveType,
      year: balance.year,
      total: balance.totalDays,
      used: balance.usedDays - scheduled,
      scheduled,
      pending: sum((r) => r.status === 'Pending'),
      remaining: balance.totalDays - balance.usedDays,
    };
  });
}
