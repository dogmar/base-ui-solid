import { createEffect } from 'solid-js';
import { addEventListener } from '@base-ui/utils/addEventListener';
import { platform } from '@base-ui/utils/platform';
import { mergeCleanups } from '@base-ui/utils/mergeCleanups';
import { ownerDocument } from '@base-ui/utils/owner';
import { getWindow, isElement, isHTMLElement } from '@floating-ui/utils/dom';
import type { ElementProps, FloatingContext, FloatingRootContext } from '../types';
import { createAttribute } from '../utils/createAttribute';
import {
  activeElement,
  contains,
  getTarget,
  isTargetInsideEnabledTrigger,
  isTypeableElement,
  matchesFocusVisible,
} from '../utils/element';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { FloatingUIOpenChangeDetails, HTMLProps } from '../../internals/types';
import { useTimeout } from '../../solid-utils/timers';

const isMacSafari = platform.os.mac && platform.engine.webkit;

export interface UseFocusProps {
  /**
   * Whether the Hook is enabled, including all internal Effects and event
   * handlers.
   * @default true
   */
  enabled?: boolean | undefined;
  /**
   * Waits for the specified time before opening.
   * @default undefined
   */
  delay?: number | (() => number | undefined) | undefined;
}

/**
 * Opens the floating element while the reference element has focus, like CSS
 * `:focus`.
 *
 * Solid port notes: `props` should be a reactive object (use getters for
 * reactive values); the option values are read lazily. React's `onFocus`/
 * `onBlur` use `focusin`/`focusout` semantics (they also fire for focus
 * changes on descendants of the reference), so the returned props use
 * `onFocusIn`/`onFocusOut`.
 * @see https://floating-ui.com/docs/useFocus
 */
export function useFocus(
  context: FloatingRootContext | FloatingContext,
  props: UseFocusProps = {},
): ElementProps {
  const enabled = () => props.enabled ?? true;

  const store = 'rootStore' in context ? context.rootStore : context;

  const { events, dataRef } = store.context;

  let blockFocus = false;
  // Track which reference should be blocked from re-opening after Escape/press dismissal.
  let blockedReference: Element | null = null;
  let keyboardModality = true;

  const timeout = useTimeout();

  createEffect(
    () => enabled(),
    (enabledValue) => {
      const domReference = store.select('domReferenceElement');

      if (!enabledValue) {
        return undefined;
      }

      const win = getWindow(domReference);

      // If the reference was focused and the user left the tab/window, and the
      // floating element was not open, the focus should be blocked when they
      // return to the tab/window.
      function onBlur() {
        const currentDomReference = store.select('domReferenceElement');
        if (
          !store.select('open') &&
          isHTMLElement(currentDomReference) &&
          currentDomReference === activeElement(ownerDocument(currentDomReference))
        ) {
          blockFocus = true;
          blockedReference = currentDomReference;
        }
      }

      function onKeyDown() {
        keyboardModality = true;
      }

      function onPointerDown() {
        keyboardModality = false;
      }

      return mergeCleanups(
        addEventListener(win, 'blur', onBlur),
        isMacSafari && addEventListener(win, 'keydown', onKeyDown, true),
        isMacSafari && addEventListener(win, 'pointerdown', onPointerDown, true),
      );
    },
  );

  createEffect(
    () => enabled(),
    (enabledValue) => {
      if (!enabledValue) {
        return undefined;
      }

      function onOpenChangeLocal(details: FloatingUIOpenChangeDetails) {
        if (details.reason === REASONS.triggerPress || details.reason === REASONS.escapeKey) {
          const referenceElement = store.select('domReferenceElement');
          if (isElement(referenceElement)) {
            blockedReference = referenceElement;
            blockFocus = true;
          }
        }
      }

      events.on('openchange', onOpenChangeLocal);
      return () => {
        events.off('openchange', onOpenChangeLocal);
      };
    },
  );

  function resetBlockedFocus() {
    blockFocus = false;
    blockedReference = null;
  }

  const referenceProps: HTMLProps = {
    onMouseLeave() {
      resetBlockedFocus();
    },
    onFocusIn(event: FocusEvent) {
      const focusTarget = event.currentTarget as Element;

      if (blockFocus) {
        if (blockedReference === focusTarget) {
          return;
        }

        resetBlockedFocus();
      }

      const target = getTarget(event);

      if (isElement(target)) {
        // Safari fails to match `:focus-visible` if focus was initially
        // outside the document.
        if (isMacSafari && !event.relatedTarget) {
          if (!keyboardModality && !isTypeableElement(target)) {
            return;
          }
        } else if (!matchesFocusVisible(target)) {
          return;
        }
      }

      const movedFromOtherEnabledTrigger = isTargetInsideEnabledTrigger(
        event.relatedTarget,
        store.context.triggerElements,
      );

      const nativeEvent = event;
      const currentTarget = event.currentTarget;
      const delayProp = props.delay;
      const delayValue = typeof delayProp === 'function' ? delayProp() : delayProp;

      if (
        (store.select('open') && movedFromOtherEnabledTrigger) ||
        delayValue === 0 ||
        delayValue === undefined
      ) {
        store.setOpen(
          true,
          createChangeEventDetails(REASONS.triggerFocus, nativeEvent, currentTarget as HTMLElement),
        );
        return;
      }

      timeout.start(delayValue, () => {
        if (blockFocus) {
          return;
        }

        store.setOpen(
          true,
          createChangeEventDetails(REASONS.triggerFocus, nativeEvent, currentTarget as HTMLElement),
        );
      });
    },
    onFocusOut(event: FocusEvent) {
      resetBlockedFocus();

      const relatedTarget = event.relatedTarget;
      const nativeEvent = event;

      // Hit the non-modal focus management portal guard. Focus will be
      // moved into the floating element immediately after.
      const movedToFocusGuard =
        isElement(relatedTarget) &&
        relatedTarget.hasAttribute(createAttribute('focus-guard')) &&
        relatedTarget.getAttribute('data-type') === 'outside';

      // Wait for the window blur listener to fire.
      timeout.start(0, () => {
        const domReference = store.select('domReferenceElement');
        const activeEl = activeElement(ownerDocument(domReference));

        // Focus left the page, keep it open.
        if (!relatedTarget && activeEl === domReference) {
          return;
        }

        // When focusing the reference element (e.g. regular click), then
        // clicking into the floating element, prevent it from hiding.
        // Note: it must be focusable, e.g. `tabindex="-1"`.
        // We can not rely on relatedTarget to point to the correct element
        // as it will only point to the shadow host of the newly focused element
        // and not the element that actually has received focus if it is located
        // inside a shadow root.
        if (
          contains(dataRef.current.floatingContext?.refs.floating.current, activeEl) ||
          contains(domReference, activeEl) ||
          movedToFocusGuard
        ) {
          return;
        }

        // If the next focused element is one of the triggers, do not close
        // the floating element. The focus handler of that trigger will
        // handle the open state.
        const nextFocusedElement = relatedTarget ?? activeEl;
        if (isTargetInsideEnabledTrigger(nextFocusedElement, store.context.triggerElements)) {
          return;
        }

        store.setOpen(false, createChangeEventDetails(REASONS.triggerFocus, nativeEvent));
      });
    },
  };

  return {
    get reference() {
      return enabled() ? referenceProps : undefined;
    },
    get trigger() {
      return enabled() ? referenceProps : undefined;
    },
  };
}
