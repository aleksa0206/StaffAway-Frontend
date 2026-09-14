import { Holiday, LeaveBalance, LeaveRequest, LeaveStatus } from '../../core/api/models';
import { monthRange, shiftMonth, startOfWeek } from '../util/dates';
import { awayCounts, buildDays, layoutBars, overlappingRequests } from './absence-layout';
import { balanceBreakdown } from './balance-breakdown';

function request(
  id: number,
  userId: number,
  startDate: string,
  endDate: string,
  status: LeaveStatus = 'Approval',
  totalDays = 1,
): LeaveRequest {
  return {
    id,
    userId,
    leaveTypeId: 1,
    status,
    startDate: `${startDate}T00:00:00.000Z`,
    endDate: `${endDate}T00:00:00.000Z`,
    totalDays,
  } as LeaveRequest;
}

describe('dates', () => {
  it('computes month ranges, including leap years', () => {
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(shiftMonth('2027-12', 1)).toBe('2028-01');
    expect(shiftMonth('2027-01', -1)).toBe('2026-12');
  });

  it('finds the Monday of a week, also from a Sunday', () => {
    expect(startOfWeek('2027-06-13')).toBe('2027-06-07');
    expect(startOfWeek('2027-06-07')).toBe('2027-06-07');
  });
});

describe('absence layout', () => {
  const holidays = [
    { id: 1, name: 'Holiday', date: '2020-06-10T00:00:00.000Z', isRecurring: true },
  ] as Holiday[];
  const days = buildDays('2027-06-07', '2027-06-13', holidays, '2027-06-08');

  it('marks weekends, holidays and today', () => {
    expect(days.map((d) => d.isWeekend)).toEqual([false, false, false, false, false, true, true]);
    expect(days[3]!.holiday).toBe('Holiday');
    expect(days[1]!.isToday).toBe(true);
  });

  it('clips bars to the visible range and flags the continuation', () => {
    const bars = layoutBars(
      [request(1, 7, '2027-06-03', '2027-06-08'), request(2, 7, '2027-06-12', '2027-06-20')],
      days,
    );
    expect(bars.get(7)).toEqual([
      expect.objectContaining({ start: 0, span: 2, continuesBefore: true, continuesAfter: false }),
      expect.objectContaining({ start: 5, span: 2, continuesBefore: false, continuesAfter: true }),
    ]);
  });

  it('ignores requests outside the range', () => {
    expect(layoutBars([request(1, 7, '2027-07-01', '2027-07-02')], days).size).toBe(0);
  });

  it('counts different people away per working day', () => {
    const counts = awayCounts(
      [
        request(1, 1, '2027-06-07', '2027-06-08'),
        request(2, 2, '2027-06-08', '2027-06-13'),
        request(3, 1, '2027-06-08', '2027-06-08'),
      ],
      days,
    );
    expect(counts).toEqual([1, 2, 1, 0, 1, 0, 0]);
  });

  it('finds other people overlapping a period', () => {
    const others = overlappingRequests(
      [
        request(1, 1, '2027-06-07', '2027-06-08'),
        request(2, 2, '2027-06-08', '2027-06-09'),
        request(3, 3, '2027-06-20', '2027-06-21'),
      ],
      { userId: 1, startDate: '2027-06-08', endDate: '2027-06-10' },
    );
    expect(others.map((r) => r.id)).toEqual([2]);
  });
});

describe('balanceBreakdown', () => {
  const balance = {
    id: 1,
    userId: 7,
    leaveTypeId: 1,
    year: 2027,
    totalDays: 20,
    usedDays: 8,
    leaveType: { id: 1, name: 'Annual leave' },
  } as LeaveBalance;

  it('splits approved days into used and scheduled, and adds pending', () => {
    const [row] = balanceBreakdown(
      [balance],
      [
        request(1, 7, '2027-03-01', '2027-03-03', 'Approval', 3),
        request(2, 7, '2027-08-02', '2027-08-06', 'Approval', 5),
        request(3, 7, '2027-09-01', '2027-09-02', 'Pending', 2),
        request(4, 7, '2027-10-01', '2027-10-01', 'Rejected', 1),
        request(5, 8, '2027-08-02', '2027-08-06', 'Approval', 5),
      ],
      '2027-06-15',
    );
    expect(row).toEqual(
      expect.objectContaining({ total: 20, used: 3, scheduled: 5, pending: 2, remaining: 12 }),
    );
  });

  it('never reports more scheduled days than the backend counted as used', () => {
    const [row] = balanceBreakdown(
      [{ ...balance, usedDays: 2 }],
      [request(1, 7, '2027-08-02', '2027-08-06', 'Approval', 5)],
      '2027-06-15',
    );
    expect(row).toEqual(expect.objectContaining({ used: 0, scheduled: 2 }));
  });
});
