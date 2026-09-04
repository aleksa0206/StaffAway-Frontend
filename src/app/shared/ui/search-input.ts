import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { Icon } from './icon';

const DEBOUNCE_MS = 300;

/** Search box that emits after the user pauses typing (and immediately on Enter or clear). */
@Component({
  selector: 'app-search-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <app-icon name="search" class="search__icon" />
    <input
      #box
      type="search"
      class="input search__input"
      [attr.aria-label]="label()"
      [placeholder]="label()"
      [value]="draft()"
      (input)="onInput(box.value)"
      (keydown.enter)="emitNow(box.value)"
    />
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      width: 260px;
      max-width: 100%;
    }
    .search__icon {
      position: absolute;
      top: 50%;
      left: 10px;
      color: var(--color-text-tertiary);
      transform: translateY(-50%);
      pointer-events: none;
    }
    .search__input {
      padding-left: 32px;
    }
  `,
})
export class SearchInput {
  readonly value = input('');
  readonly label = input('Search');
  readonly search = output<string>();

  protected readonly draft = signal('');
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // Keep the box in sync when the value changes from outside (e.g. back navigation).
    effect(() => this.draft.set(this.value()));
  }

  protected onInput(value: string): void {
    this.draft.set(value);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.search.emit(value.trim()), value ? DEBOUNCE_MS : 0);
  }

  protected emitNow(value: string): void {
    clearTimeout(this.timer);
    this.search.emit(value.trim());
  }
}
