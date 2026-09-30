import { ownerDocument } from '@base-ui/utils/owner';
import type { BaseUIEvent } from '../internals/types';

/**
 * Returns `click` and `mousedown` handlers that fix the behavior of triggers of popups that are toggled by different events.
 * For example, a button that opens a popup on mousedown and closes it on click.
 * This hook prevents the popup from closing immediately after the mouse button is released.
 *
 * Solid port note: `params` should be a reactive object (use getters for `enabled` and `open`);
 * the returned handlers read them lazily when the events fire.
 */
export function useMixedToggleClickHandler(params: UseMixedToggleClickHandlerParameters) {
  let ignoreClick = false;

  return {
    onMouseDown: (event: MouseEvent) => {
      const enabled = params.enabled ?? true;
      if (!enabled) {
        return;
      }

      const { mouseDownAction, open } = params;
      if ((mouseDownAction === 'open' && !open) || (mouseDownAction === 'close' && open)) {
        ignoreClick = true;

        ownerDocument(event.currentTarget as Element).addEventListener(
          'click',
          () => {
            ignoreClick = false;
          },
          { once: true },
        );
      }
    },
    onClick: (event: BaseUIEvent<MouseEvent>) => {
      if ((params.enabled ?? true) && ignoreClick) {
        ignoreClick = false;
        event.preventBaseUIHandler();
      }
    },
  };
}

export interface UseMixedToggleClickHandlerParameters {
  /**
   * Whether the mixed toggle click handler is enabled.
   * @default true
   */
  enabled?: boolean | undefined;
  /**
   * Determines what action is performed on mousedown.
   */
  mouseDownAction: 'open' | 'close';
  /**
   * The current open state of the popup.
   */
  open: boolean;
}

export interface UseMixedToggleClickHandlerState {}
