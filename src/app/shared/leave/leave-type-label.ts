import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { leaveTypeColor } from './leave-type-color';

@Component({
  selector: 'app-leave-type',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="leave-type" [style.--leave-color]="color()">{{ type().name }}</span>`,
})
export class LeaveTypeLabel {
  readonly type = input.required<{ id: number; name: string }>();
  protected readonly color = computed(() => leaveTypeColor(this.type().id));
}
