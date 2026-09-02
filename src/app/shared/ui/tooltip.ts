import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  ElementRef,
  inject,
  input,
  OnDestroy,
  signal,
} from '@angular/core';

let nextId = 0;

@Component({
  selector: 'app-tooltip-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tooltip', role: 'tooltip', '[id]': 'id()' },
  template: `{{ text() }}`,
  styles: `
    :host {
      display: block;
      white-space: pre-line;
    }
  `,
})
export class TooltipPanel {
  readonly text = signal('');
  readonly id = signal('');
}

/**
 * Tooltip shown on hover *and* keyboard focus (WCAG 1.4.13), dismissed with Escape.
 * Use it for supplementary detail only; essential information must be visible without it.
 */
@Directive({
  selector: '[appTooltip]',
  host: {
    '(mouseenter)': 'show()',
    '(mouseleave)': 'hide()',
    '(focus)': 'show()',
    '(blur)': 'hide()',
    '(keydown.escape)': 'hide()',
    '[attr.aria-describedby]': 'overlayRef ? tooltipId : null',
  },
})
export class Tooltip implements OnDestroy {
  readonly appTooltip = input.required<string>();

  private readonly overlay = inject(Overlay);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected overlayRef: OverlayRef | null = null;
  protected readonly tooltipId = `tooltip-${++nextId}`;

  show(): void {
    if (this.overlayRef || !this.appTooltip()) return;
    this.overlayRef = this.overlay.create({
      positionStrategy: this.overlay
        .position()
        .flexibleConnectedTo(this.host)
        .withPositions([
          {
            originX: 'center',
            originY: 'top',
            overlayX: 'center',
            overlayY: 'bottom',
            offsetY: -6,
          },
          { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 6 },
        ]),
      scrollStrategy: this.overlay.scrollStrategies.close(),
    });
    const panel = this.overlayRef.attach(new ComponentPortal(TooltipPanel)).instance;
    panel.text.set(this.appTooltip());
    panel.id.set(this.tooltipId);
  }

  hide(): void {
    this.overlayRef?.dispose();
    this.overlayRef = null;
  }

  ngOnDestroy(): void {
    this.hide();
  }
}
