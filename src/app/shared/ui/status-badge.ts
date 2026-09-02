import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LeaveStatus } from '../../core/api/models';

const STATUS_VIEW: Record<LeaveStatus, { label: string; tone: string }> = {
  Pending: { label: 'Pending', tone: 'warning' },
  Approval: { label: 'Approved', tone: 'success' },
  Rejected: { label: 'Rejected', tone: 'danger' },
  Cancelled: { label: 'Cancelled', tone: 'neutral' },
};

export function leaveStatusLabel(status: LeaveStatus): string {
  return STATUS_VIEW[status].label;
}

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="'badge badge--' + view().tone">{{ view().label }}</span>`,
})
export class StatusBadge {
  readonly status = input.required<LeaveStatus>();
  protected readonly view = computed(() => STATUS_VIEW[this.status()]);
}
