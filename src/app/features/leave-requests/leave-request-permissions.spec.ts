import { CurrentUser, LeaveRequest, LeaveStatus, Role } from '../../core/api/models';
import {
  canCancelRequest,
  canCommentOnRequest,
  canDecideRequest,
  canModifyRequest,
} from './leave-request-permissions';

function user(id: number, role: Role): CurrentUser {
  return { id, role } as CurrentUser;
}

function request(userId: number, status: LeaveStatus = 'Pending'): LeaveRequest {
  return { id: 10, userId, status } as LeaveRequest;
}

describe('leave request permissions', () => {
  describe('canModifyRequest', () => {
    it('the owner can edit their own pending request', () => {
      expect(canModifyRequest(request(1), user(1, 'Employee'))).toBe(true);
    });

    it('an approved request cannot be edited, even by the owner', () => {
      expect(canModifyRequest(request(1, 'Approval'), user(1, 'Employee'))).toBe(false);
    });

    it("Hr does not edit someone else's request through the form", () => {
      expect(canModifyRequest(request(1), user(2, 'Hr'))).toBe(false);
    });
  });

  describe('canDecideRequest', () => {
    it('an Employee never decides', () => {
      expect(canDecideRequest(request(1), user(2, 'Employee'), 2)).toBe(false);
    });

    it('nobody decides on their own request, not even Hr', () => {
      expect(canDecideRequest(request(2), user(2, 'Hr'), null)).toBe(false);
    });

    it('a Manager only decides on direct reports', () => {
      expect(canDecideRequest(request(1), user(2, 'Manager'), 2)).toBe(true);
      expect(canDecideRequest(request(1), user(2, 'Manager'), 3)).toBe(false);
      expect(canDecideRequest(request(1), user(2, 'Manager'), undefined)).toBe(false);
    });

    it('Hr decides on everyone else', () => {
      expect(canDecideRequest(request(1), user(2, 'Hr'), 5)).toBe(true);
    });

    it('a rejected request is no longer decided on', () => {
      expect(canDecideRequest(request(1, 'Rejected'), user(2, 'Hr'), null)).toBe(false);
    });
  });

  it('the owner or a Manager/Hr can comment, but not other employees', () => {
    expect(canCommentOnRequest(request(1), user(1, 'Employee'))).toBe(true);
    expect(canCommentOnRequest(request(1), user(2, 'Manager'))).toBe(true);
    expect(canCommentOnRequest(request(1), user(2, 'Employee'))).toBe(false);
  });

  describe('canCancelRequest', () => {
    const today = '2027-06-15';
    const future = (status: LeaveStatus) =>
      ({ id: 1, userId: 1, status, startDate: '2027-07-01T00:00:00.000Z' }) as LeaveRequest;

    it('the owner can cancel pending or approved leave that has not started', () => {
      expect(canCancelRequest(future('Pending'), user(1, 'Employee'), today)).toBe(true);
      expect(canCancelRequest(future('Approval'), user(1, 'Employee'), today)).toBe(true);
    });

    it("not someone else's, not rejected, and not once it has started", () => {
      expect(canCancelRequest(future('Pending'), user(2, 'Hr'), today)).toBe(false);
      expect(canCancelRequest(future('Rejected'), user(1, 'Employee'), today)).toBe(false);
      expect(canCancelRequest(future('Approval'), user(1, 'Employee'), '2027-07-01')).toBe(false);
    });
  });
});
