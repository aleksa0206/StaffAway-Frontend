import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { BalanceBreakdown } from './balance-breakdown';
import { leaveTypeColor } from './leave-type-color';
import { LeaveTypeLabel } from './leave-type-label';

/**
 * Entitlement per leave type. The bar is a visual aid only (hidden from screen readers); every
 * number is also written out, so nothing depends on colour.
 */
@Component({
  selector: 'app-balance-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LeaveTypeLabel],
  template: `
    @for (row of rows(); track row.balanceId) {
      <div class="balance" [style.--leave-color]="color(row.leaveType.id)">
        <div class="balance__head">
          <app-leave-type [type]="row.leaveType" />
          <span class="balance__remaining" [class.balance__remaining--negative]="row.remaining < 0">
            <strong>{{ row.remaining }}</strong> of {{ row.total }} days left
          </span>
        </div>
        <div class="bar" aria-hidden="true">
          <span class="bar__used" [style.flex-grow]="row.used"></span>
          <span class="bar__scheduled" [style.flex-grow]="row.scheduled"></span>
          <span class="bar__pending" [style.flex-grow]="pendingShown(row)"></span>
          <span class="bar__free" [style.flex-grow]="free(row)"></span>
        </div>
        <dl class="legend">
          <div>
            <dt>Used</dt>
            <dd>{{ row.used }}</dd>
          </div>
          <div>
            <dt>Scheduled</dt>
            <dd>{{ row.scheduled }}</dd>
          </div>
          <div>
            <dt>Pending</dt>
            <dd>{{ row.pending }}</dd>
          </div>
          <div>
            <dt>Entitlement</dt>
            <dd>{{ row.total }}</dd>
          </div>
        </dl>
      </div>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-5);
    }
    .balance__head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-3);
      font-weight: var(--font-weight-medium);
    }
    .balance__remaining {
      color: var(--color-text-secondary);
      font-size: var(--font-size-secondary);
      white-space: nowrap;
    }
    .balance__remaining strong {
      color: var(--color-text);
      font-size: 18px;
    }
    .balance__remaining--negative strong {
      color: var(--color-danger);
    }
    .bar {
      display: flex;
      gap: 2px;
      height: 8px;
      margin: var(--space-2) 0;
      overflow: hidden;
      border-radius: 4px;
      background: var(--color-surface-hover);
    }
    .bar > span {
      flex-basis: 0;
    }
    .bar__used {
      background: var(--leave-color);
    }
    .bar__scheduled {
      background: color-mix(in srgb, var(--leave-color) 50%, white);
    }
    .bar__pending {
      background: repeating-linear-gradient(
        -45deg,
        color-mix(in srgb, var(--leave-color) 45%, white) 0 3px,
        transparent 3px 6px
      );
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1) var(--space-4);
      font-size: var(--font-size-meta);
      color: var(--color-text-tertiary);
    }
    .legend div {
      display: flex;
      gap: 4px;
    }
    .legend dd {
      color: var(--color-text);
      font-weight: var(--font-weight-medium);
    }
  `,
})
export class BalanceSummary {
  readonly rows = input.required<readonly BalanceBreakdown[]>();

  protected color(leaveTypeId: number): string {
    return leaveTypeColor(leaveTypeId);
  }

  // Pending days are shown within what is left, so the bar never exceeds the entitlement.
  protected pendingShown(row: BalanceBreakdown): number {
    return Math.max(0, Math.min(row.pending, row.remaining));
  }

  protected free(row: BalanceBreakdown): number {
    return Math.max(0, row.remaining - this.pendingShown(row));
  }
}
