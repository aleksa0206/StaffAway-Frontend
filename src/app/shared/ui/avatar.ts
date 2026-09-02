import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PersonRef } from '../../core/api/models';

// Soft backgrounds with dark text of the same hue; picked by id so a person keeps their colour.
const PALETTE = [
  ['#e3ecfb', '#23508f'],
  ['#e2f4ef', '#17665a'],
  ['#efe7fb', '#5a3a98'],
  ['#fcefe0', '#8a4f0c'],
  ['#fbe6ec', '#8f2946'],
  ['#e7f3e2', '#345f25'],
  ['#e9edf3', '#3d4a5d'],
  ['#fbeae1', '#8a3f14'],
] as const;

/** Initials avatar. Decorative next to the person's name, so it is hidden from screen readers. */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[style.font-size.px]': 'size() * 0.4',
    '[style.background]': 'colors()[0]',
    '[style.color]': 'colors()[1]',
  },
  template: `{{ initials() }}`,
  styles: `
    :host {
      display: inline-grid;
      flex-shrink: 0;
      place-items: center;
      border-radius: 50%;
      font-weight: var(--font-weight-semibold);
      line-height: 1;
      letter-spacing: 0.02em;
      user-select: none;
    }
  `,
})
export class Avatar {
  readonly person = input.required<PersonRef>();
  readonly size = input(28);

  protected readonly initials = computed(() => {
    const { firstName, lastName } = this.person();
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  });

  protected readonly colors = computed(() => PALETTE[this.person().id % PALETTE.length]);
}
