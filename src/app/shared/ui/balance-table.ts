import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LeaveBalance } from '../../core/api/models';
import { SkeletonRows } from './feedback';
import { Icon } from './icon';

/** Balance table: employees see their own; Hr sees the same view (with actions) on an employee's profile. */
@Component({
  selector: 'app-balance-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonRows, Icon],
  template: `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th scope="col">Leave type</th>
            @if (showYear()) {
              <th scope="col" class="num">Year</th>
            }
            <th scope="col" class="num">Total</th>
            <th scope="col" class="num">Used</th>
            <th scope="col" class="num">Remaining</th>
            @if (editable()) {
              <th scope="col" class="actions"><span class="visually-hidden">Actions</span></th>
            }
          </tr>
        </thead>
        @if (balances(); as rows) {
          <tbody>
            @for (b of rows; track b.id) {
              <tr>
                <td>{{ b.leaveType.name }}</td>
                @if (showYear()) {
                  <td class="num">{{ b.year }}</td>
                }
                <td class="num">{{ b.totalDays }}</td>
                <td class="num">{{ b.usedDays }}</td>
                <td class="num" [class.balance--negative]="b.totalDays - b.usedDays < 0">
                  <strong>{{ b.totalDays - b.usedDays }}</strong>
                </td>
                @if (editable()) {
                  <td class="actions">
                    <button
                      type="button"
                      class="btn btn--ghost btn--icon btn--sm"
                      [attr.aria-label]="'Edit balance ' + b.leaveType.name + ' ' + b.year"
                      (click)="edit.emit(b)"
                    >
                      <app-icon name="pencil" [size]="14" />
                    </button>
                    <button
                      type="button"
                      class="btn btn--ghost btn--icon btn--sm"
                      [attr.aria-label]="'Delete balance ' + b.leaveType.name + ' ' + b.year"
                      (click)="remove.emit(b)"
                    >
                      <app-icon name="trash" [size]="14" />
                    </button>
                  </td>
                }
              </tr>
            }
          </tbody>
        } @else {
          <tbody appSkeletonRows [columns]="editable() ? 6 : 4" rows="3"></tbody>
        }
      </table>
    </div>
  `,
  styles: `
    .balance--negative {
      color: var(--color-danger);
    }
  `,
})
export class BalanceTable {
  readonly balances = input.required<LeaveBalance[] | undefined>();
  readonly showYear = input(false);
  readonly editable = input(false);
  readonly edit = output<LeaveBalance>();
  readonly remove = output<LeaveBalance>();
}
