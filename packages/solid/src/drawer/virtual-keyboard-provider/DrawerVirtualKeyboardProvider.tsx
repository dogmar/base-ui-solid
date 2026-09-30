import { createEffect } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { getComputedStyle, getParentNode, isHTMLElement } from '@floating-ui/utils/dom';
import { addEventListener } from '@base-ui/utils/addEventListener';
import { ownerDocument, ownerWindow } from '@base-ui/utils/owner';
import { clamp } from '@base-ui/utils/clamp';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import { activeElement, contains, getTarget, isInteractiveElement } from '../../floating-ui-react/utils/element';
import { findScrollableTouchTarget } from '../../utils/scrollable';
import { getElementAtPoint } from '../../utils/getElementAtPoint';
import { useAnimationFrame, useTimeout } from '../../solid-utils/timers';
import { IsolateChildren } from '../../solid-utils/isolateChildren';
import * as DrawerViewportCssVars from '../viewport/DrawerViewportCssVars';
import {
  DrawerVirtualKeyboardContext,
  type DrawerVirtualKeyboardContext as DrawerVirtualKeyboardContextValue,
} from './DrawerVirtualKeyboardContext';

const KEYBOARD_RESIZE_THRESHOLD = 60;
const KEYBOARD_VISIBILITY_MARGIN = 16;
// Extra breathing room (px) added below the focused field, on top of its measured
// keyboard overlap, so the field can be scrolled clear of the keyboard instead of
// ending up flush against it. Only applied when there is actual overlap.
const KEYBOARD_SCROLL_SLACK = 48;
// Cadence of the settle-watching realign passes after focus moves with the keyboard open.
const KEYBOARD_REALIGN_INTERVAL = 150;
const KEYBOARD_REALIGN_MAX_PASSES = 4;
// Frames the alignment waits for the scroll destination to stop moving before scrolling anyway.
const KEYBOARD_SETTLE_FRAME_LIMIT = 60;
const INPUT_TAP_MOVE_THRESHOLD = 10;
const INPUT_TAP_HIT_SLOP = 16;
const KEYBOARD_INPUT_TYPES = new Set([
  'email',
  'number',
  'password',
  'search',
  'tel',
  'text',
  'url',
]);

// Snapshot of a scroll container's relevant styles taken before keyboard slack is
// applied. The string fields are the exact inline values to restore on cleanup;
// the parsed numbers are the computed baselines that slack is added on top of.
interface ScrollAdjustment {
  readonly element: HTMLElement;
  readonly overflowAnchor: string;
  readonly paddingBottom: string;
  readonly scrollPaddingBottom: string;
  readonly computedPaddingBottom: number;
  readonly computedScrollPaddingBottom: number;
}

interface KeyboardVisualViewport {
  readonly top: number;
  readonly bottom: number;
}

interface KeyboardTouchTarget {
  readonly focusTarget: HTMLElement;
  readonly clickTarget: HTMLElement;
}

// Returned by the point-based resolver when the lift point lands on another
// interactive/label element. It signals that the tap was intentionally rejected, so the
// caller must NOT fall back to the touchstart target (`touchend.target` stays at the
// touchstart node on mobile) — doing so would steal a tap meant for that element.
const KEYBOARD_TAP_BLOCKED = Symbol('KeyboardTapBlocked');

/**
 * Provides keyboard-aware focus and scroll handling for bottom-sheet drawers with form fields.
 *
 * Documentation: [Base UI Drawer](https://base-ui.com/react/components/drawer)
 */
export function DrawerVirtualKeyboardProvider(
  props: DrawerVirtualKeyboardProvider.Props,
): JSX.Element {
  const store = useDialogRootContext();

  const open = store.useState('open');
  const mounted = store.useState('mounted');
  const modal = store.useState('modal');
  const nestedOpenDialogCount = store.useState('nestedOpenDialogCount');
  const viewportElement = store.useState('viewportElement');

  // The provider requires a `<Drawer.Viewport>` to act as the measurement and containment
  // root and to host the keyboard inset variable; `<Drawer.Popup>` already warns when the
  // viewport is missing, so there is no need to fall back to the popup element here.
  const rootElement = viewportElement;
  const nestedDrawerOpen = () => nestedOpenDialogCount() > 0;

  let pendingKeyboardFocusMoved = false;
  let keyboardTouchStart: { x: number; y: number } | null = null;
  const focusedKeyboardTargetRef: { current: HTMLElement | null } = { current: null };
  let keyboardScrollAdjustment: ScrollAdjustment | null = null;
  const programmaticKeyboardFocusRef = { current: false };
  const keyboardFocusFrame = useAnimationFrame();
  const keyboardRealignTimeout = useTimeout();

  const restoreKeyboardScrollAdjustment = () => {
    const adjustment = keyboardScrollAdjustment;
    if (!adjustment) {
      return;
    }
    adjustment.element.style.overflowAnchor = adjustment.overflowAnchor;
    adjustment.element.style.paddingBottom = adjustment.paddingBottom;
    adjustment.element.style.scrollPaddingBottom = adjustment.scrollPaddingBottom;
    keyboardScrollAdjustment = null;
  };

  const setKeyboardScrollSlack = (element: HTMLElement, slack: number) => {
    const roundedSlack = Math.max(0, Math.ceil(slack));
    let adjustment = keyboardScrollAdjustment;

    if (adjustment && !adjustment.element.isConnected) {
      restoreKeyboardScrollAdjustment();
      adjustment = null;
    }

    if (roundedSlack === 0) {
      restoreKeyboardScrollAdjustment();
      return;
    }

    if (adjustment && adjustment.element !== element) {
      restoreKeyboardScrollAdjustment();
      adjustment = null;
    }

    if (!adjustment) {
      const styles = getComputedStyle(element);
      adjustment = {
        element,
        overflowAnchor: element.style.overflowAnchor,
        paddingBottom: element.style.paddingBottom,
        scrollPaddingBottom: element.style.scrollPaddingBottom,
        computedPaddingBottom: Number.parseFloat(styles.paddingBottom) || 0,
        computedScrollPaddingBottom: Number.parseFloat(styles.scrollPaddingBottom) || 0,
      };
      keyboardScrollAdjustment = adjustment;
    }

    element.style.overflowAnchor = 'none';
    element.style.paddingBottom = `${adjustment.computedPaddingBottom + roundedSlack}px`;
    element.style.scrollPaddingBottom = `${
      adjustment.computedScrollPaddingBottom + KEYBOARD_VISIBILITY_MARGIN
    }px`;
  };

  const animateKeyboardScroll = (element: HTMLElement, scrollTop: number) => {
    const win = ownerWindow(element);
    const behavior: ScrollBehavior = win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
      ? 'auto'
      : 'smooth';

    element.scrollTo({ top: scrollTop, behavior });
  };

  const resetTouchTrackingState = () => {
    pendingKeyboardFocusMoved = false;
    keyboardTouchStart = null;
  };

  createEffect(
    () => ({
      mounted: mounted(),
      open: open(),
      rootElement: rootElement(),
      modal: modal(),
      nestedDrawerOpen: nestedDrawerOpen(),
    }),
    (current) => {
      if (!current.mounted || !current.open) {
        focusedKeyboardTargetRef.current = null;
        restoreKeyboardScrollAdjustment();
        keyboardFocusFrame.cancel();
        return undefined;
      }

      const currentRootElement = current.rootElement;
      if (!currentRootElement) {
        restoreKeyboardScrollAdjustment();
        return undefined;
      }

      const doc = ownerDocument(currentRootElement);
      const win = ownerWindow(currentRootElement);
      const visualViewport = win.visualViewport;

      // Alignment scroll bookkeeping: destination stability, whether a scroll was issued,
      // and the last observed progress so delayed passes can distinguish moving from stalled.
      let keyboardScrollElement: HTMLElement | null = null;
      let keyboardScrollDestination = 0;
      let keyboardScrollChecks = 0;
      let keyboardScrollObserved = -1;

      const setDrawerKeyboardInset = (inset: number) => {
        currentRootElement.style.setProperty(
          DrawerViewportCssVars.keyboardInset,
          `${Math.max(0, Math.ceil(inset))}px`,
        );
      };

      const clearFocusedKeyboardTarget = () => {
        focusedKeyboardTargetRef.current = null;
        keyboardScrollElement = null;
        setDrawerKeyboardInset(0);
        restoreKeyboardScrollAdjustment();
        keyboardFocusFrame.cancel();
        keyboardRealignTimeout.clear();
      };

      // WebKit's native reveal scroll can move the page even while the scroll lock hides
      // overflow. While the drawer is modal, any window scroll during keyboard interaction is
      // spurious, so pin the page to the position it had when the drawer opened.
      const baseScrollX = win.scrollX;
      const baseScrollY = win.scrollY;

      const restoreWindowScroll = (): boolean => {
        if (
          current.modal !== true ||
          current.nestedDrawerOpen ||
          !focusedKeyboardTargetRef.current ||
          getKeyboardVisualViewport(win) == null
        ) {
          return false;
        }

        if (win.scrollX !== baseScrollX || win.scrollY !== baseScrollY) {
          // Force an instant jump: the two-argument form defaults `behavior` to `auto`, which
          // obeys the page's `scroll-behavior`, so a global `scroll-behavior: smooth` would
          // animate the restore.
          win.scrollTo({ left: baseScrollX, top: baseScrollY, behavior: 'instant' });
          return true;
        }

        return false;
      };

      // Focus moved by the drawer itself goes through `focusKeyboardInputWithoutPageScroll`,
      // but native focus changes commit WebKit's reveal scroll before `focusin` reaches us.
      // `focusout` on the outgoing field fires before focus lands, so override the incoming
      // field's geometry there and restore it in `focusin`.
      let restorePreemptedFocus: (() => void) | null = null;

      const consumePreemptedFocus = () => {
        restorePreemptedFocus?.();
        restorePreemptedFocus = null;
      };

      const preemptFocusReveal = (
        target: HTMLElement,
        keyboardViewport: KeyboardVisualViewport,
      ) => {
        consumePreemptedFocus();

        const rect = target.getBoundingClientRect();

        restorePreemptedFocus = overrideGeometryDuringFocus(
          target,
          (keyboardViewport.top + keyboardViewport.bottom - rect.top - rect.bottom) / 2,
        );
      };

      const alignFocusedKeyboardTarget = () => {
        // If focus never lands on a preempted target, the focusout-scheduled alignment still
        // restores it on the next frame before paint.
        consumePreemptedFocus();

        const target = focusedKeyboardTargetRef.current;
        if (current.nestedDrawerOpen || !target || !contains(currentRootElement, target)) {
          setDrawerKeyboardInset(0);
          restoreKeyboardScrollAdjustment();
          return;
        }

        // Undo any reveal scroll WebKit applied to the locked page before measuring.
        restoreWindowScroll();

        const keyboardViewport = getKeyboardVisualViewport(win);
        if (!keyboardViewport) {
          setDrawerKeyboardInset(0);
          restoreKeyboardScrollAdjustment();
          return;
        }

        setDrawerKeyboardInset(Math.max(0, win.innerHeight - keyboardViewport.bottom));

        const scrollTarget = findKeyboardScrollTarget(target, currentRootElement);
        if (!scrollTarget) {
          restoreKeyboardScrollAdjustment();
          return;
        }

        const scrollTargetRect = scrollTarget.getBoundingClientRect();
        const clippedBottom = Math.min(scrollTargetRect.bottom, keyboardViewport.bottom);
        const overlap = Math.max(0, scrollTargetRect.bottom - keyboardViewport.bottom);
        setKeyboardScrollSlack(scrollTarget, overlap > 0 ? overlap + KEYBOARD_SCROLL_SLACK : 0);

        const maxScrollTop = Math.max(0, scrollTarget.scrollHeight - scrollTarget.clientHeight);
        if (maxScrollTop <= 0) {
          return;
        }

        const clippedTop = Math.max(scrollTargetRect.top, keyboardViewport.top);
        const visibleTop = clippedTop + KEYBOARD_VISIBILITY_MARGIN;
        const visibleBottom = clippedBottom - KEYBOARD_VISIBILITY_MARGIN;
        if (visibleBottom <= visibleTop) {
          return;
        }

        const targetRect = target.getBoundingClientRect();
        const nextScrollTop =
          scrollTarget.scrollTop +
          (targetRect.top + targetRect.bottom - visibleTop - visibleBottom) / 2;
        const destination = Math.round(clamp(nextScrollTop, 0, maxScrollTop));

        const settled =
          keyboardScrollElement === scrollTarget &&
          Math.abs(keyboardScrollDestination - destination) <= 1;

        if (!settled) {
          // Commit the scroll only once the destination holds across two consecutive checks.
          const checks = keyboardScrollElement === scrollTarget ? keyboardScrollChecks + 1 : 1;
          keyboardScrollElement = scrollTarget;
          keyboardScrollDestination = destination;
          keyboardScrollChecks = checks;
          keyboardScrollObserved = -1;
          // Re-check next frame; give up and scroll anyway if layout never settles.
          if (checks <= KEYBOARD_SETTLE_FRAME_LIMIT) {
            keyboardFocusFrame.request(alignFocusedKeyboardTarget);
            return;
          }
        } else if (keyboardScrollObserved >= 0) {
          // A scroll toward this destination is already out. Leave it alone while it has
          // arrived or is still progressing, and re-issue only when it stalled short.
          const currentScroll = scrollTarget.scrollTop;
          if (Math.abs(currentScroll - destination) <= 1) {
            return;
          }
          if (currentScroll !== keyboardScrollObserved) {
            keyboardScrollObserved = currentScroll;
            return;
          }
        }

        keyboardScrollElement = scrollTarget;
        keyboardScrollDestination = destination;
        keyboardScrollChecks = 0;
        keyboardScrollObserved = scrollTarget.scrollTop;
        animateKeyboardScroll(scrollTarget, destination);
      };

      const scheduleKeyboardFocusAlignment = () => {
        keyboardFocusFrame.request(alignFocusedKeyboardTarget);
      };

      // When focus moves with the keyboard already up, no viewport resize events follow to
      // re-run alignment; re-align on an interval until both settle.
      const scheduleDelayedKeyboardRealign = () => {
        let remainingPasses = KEYBOARD_REALIGN_MAX_PASSES;
        const realign = () => {
          alignFocusedKeyboardTarget();
          remainingPasses -= 1;
          if (remainingPasses > 0) {
            keyboardRealignTimeout.start(KEYBOARD_REALIGN_INTERVAL, realign);
          }
        };
        keyboardRealignTimeout.start(KEYBOARD_REALIGN_INTERVAL, realign);
      };

      const captureFocusedKeyboardTarget = (eventTarget: EventTarget | null) => {
        if (current.nestedDrawerOpen) {
          return false;
        }

        // Resolve through the same path as taps so contentEditable hosts (and labelled
        // controls) are normalized identically for the focus and touch paths.
        const target = resolveKeyboardInputTarget(eventTarget);
        if (!target || !contains(currentRootElement, target)) {
          return false;
        }

        // A new field starts a fresh alignment; the scroll bookkeeping must not carry
        // over from the previous field's scroll.
        if (focusedKeyboardTargetRef.current !== target) {
          keyboardScrollElement = null;
        }
        focusedKeyboardTargetRef.current = target;
        return true;
      };

      const handleFocusIn = (event: FocusEvent) => {
        // The programmatic transition is over once focus lands.
        programmaticKeyboardFocusRef.current = false;

        consumePreemptedFocus();

        if (!captureFocusedKeyboardTarget(getTarget(event))) {
          // Focus landed outside any drawer keyboard input; reconcile against the real focus.
          clearFocusedKeyboardTarget();
          return;
        }

        // Covers every way focus can land with the keyboard already up.
        if (getKeyboardVisualViewport(win) != null) {
          scheduleDelayedKeyboardRealign();
        }

        scheduleKeyboardFocusAlignment();
      };

      const handleFocusOut = (event: FocusEvent) => {
        // The blur inside `focusKeyboardInputWithoutPageScroll` is followed synchronously by
        // a re-focus; clearing state here would drop the keyboard inset for a frame.
        if (programmaticKeyboardFocusRef.current) {
          return;
        }

        if (captureFocusedKeyboardTarget(event.relatedTarget)) {
          const target = focusedKeyboardTargetRef.current;
          const keyboardViewport = getKeyboardVisualViewport(win);
          // The delayed realign passes are scheduled by the `focusin` that follows once
          // focus lands on the captured target.
          if (target && keyboardViewport) {
            preemptFocusReveal(target, keyboardViewport);
          }
          scheduleKeyboardFocusAlignment();
          return;
        }

        clearFocusedKeyboardTarget();
      };

      const handleViewportUpdate = () => {
        if (focusedKeyboardTargetRef.current || captureFocusedKeyboardTarget(activeElement(doc))) {
          scheduleKeyboardFocusAlignment();
        }
      };

      const cleanupListeners: Array<() => void> = [];

      if (visualViewport) {
        cleanupListeners.push(
          addEventListener(visualViewport, 'resize', handleViewportUpdate),
          addEventListener(visualViewport, 'scroll', handleViewportUpdate),
        );
      }

      const handleWindowScroll = () => {
        if (restoreWindowScroll()) {
          // Recompute the keyboard inset once the page is back at rest.
          scheduleKeyboardFocusAlignment();
        }
      };

      // Once the user puts a finger down they own the scroll position.
      const cancelKeyboardRealignOnPointerDown = () => {
        keyboardFocusFrame.cancel();
        keyboardRealignTimeout.clear();
        keyboardScrollElement = null;
      };

      cleanupListeners.push(
        addEventListener(doc, 'focusin', handleFocusIn, true),
        addEventListener(doc, 'focusout', handleFocusOut, true),
        addEventListener(win, 'scroll', handleWindowScroll),
        addEventListener(doc, 'pointerdown', cancelKeyboardRealignOnPointerDown, true),
      );

      if (captureFocusedKeyboardTarget(activeElement(doc))) {
        scheduleKeyboardFocusAlignment();
      }

      return () => {
        cleanupListeners.forEach((cleanup) => cleanup());
        consumePreemptedFocus();
        clearFocusedKeyboardTarget();
        currentRootElement.style.removeProperty(DrawerViewportCssVars.keyboardInset);
      };
    },
  );

  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    pendingKeyboardFocusMoved = false;
    keyboardTouchStart = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchMove = (event: TouchEvent) => {
    const touch = event.touches[0];
    const touchStart = keyboardTouchStart;

    if (!touch || !touchStart || pendingKeyboardFocusMoved) {
      return;
    }

    // Treat the gesture as a scroll/swipe (not a tap-to-focus) once the finger
    // moves past the threshold, so we don't open the keyboard on a drag.
    if (
      Math.abs(touch.clientX - touchStart.x) > INPUT_TAP_MOVE_THRESHOLD ||
      Math.abs(touch.clientY - touchStart.y) > INPUT_TAP_MOVE_THRESHOLD
    ) {
      pendingKeyboardFocusMoved = true;
    }
  };

  const onTouchEnd = (event: TouchEvent) => {
    const currentRootElement = rootElement();
    if (
      !store.select('open') ||
      !store.select('mounted') ||
      nestedDrawerOpen() ||
      !currentRootElement ||
      !keyboardTouchStart ||
      pendingKeyboardFocusMoved
    ) {
      resetTouchTrackingState();
      return;
    }

    const touch = event.changedTouches[0] ?? event.touches[0];
    const root = currentRootElement.getRootNode();
    const nativeEventTarget = getTarget(event);
    const pointTarget = touch
      ? resolveKeyboardTouchTargetFromPoint(root, touch.clientX, touch.clientY)
      : null;

    // The lift point landed on another interactive/label element; let its native tap
    // through instead of stealing it for the touchstart input.
    if (pointTarget === KEYBOARD_TAP_BLOCKED) {
      resetTouchTrackingState();
      return;
    }

    const keyboardTarget = touch && (pointTarget ?? resolveKeyboardTouchTarget(nativeEventTarget));

    if (
      keyboardTarget &&
      (!contains(currentRootElement, keyboardTarget.focusTarget) ||
        !contains(currentRootElement, keyboardTarget.clickTarget))
    ) {
      resetTouchTrackingState();
      return;
    }

    if (keyboardTarget) {
      const { clickTarget: keyboardClickTarget, focusTarget: keyboardFocusTarget } = keyboardTarget;
      const win = ownerWindow(keyboardFocusTarget);

      // While pinch-zoomed, keyboard alignment is suspended; let native behavior
      // handle focus and caret placement instead of blurring and re-focusing.
      if (win.visualViewport && win.visualViewport.scale !== 1) {
        resetTouchTrackingState();
        return;
      }

      // Already focused with the keyboard up: let the native tap through so it can
      // reposition the caret, rather than blurring and re-focusing the same input.
      if (
        activeElement(ownerDocument(keyboardFocusTarget)) === keyboardFocusTarget &&
        (!win.visualViewport || getKeyboardVisualViewport(win) != null)
      ) {
        resetTouchTrackingState();
        return;
      }

      // iOS only opens the software keyboard when focus happens synchronously
      // inside the touch gesture.
      event.preventDefault();
      programmaticKeyboardFocusRef.current = true;
      try {
        focusKeyboardInputWithoutPageScroll(keyboardFocusTarget);
      } finally {
        programmaticKeyboardFocusRef.current = false;
      }
      // Preventing the touchend default also suppresses the compatibility mouse
      // events, including `click`; redispatch an untrusted replacement on the
      // original tap target so click handlers still run with the tap coordinates.
      dispatchKeyboardClick(keyboardClickTarget, touch);
      resetTouchTrackingState();
      return;
    }

    resetTouchTrackingState();
  };

  const contextValue: DrawerVirtualKeyboardContextValue = {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel: resetTouchTrackingState,
  };

  return (
    <DrawerVirtualKeyboardContext value={contextValue}>
      <IsolateChildren>{props.children}</IsolateChildren>
    </DrawerVirtualKeyboardContext>
  );
}

export interface DrawerVirtualKeyboardProviderState {}

export interface DrawerVirtualKeyboardProviderProps {
  children?: JSX.Element;
}

export namespace DrawerVirtualKeyboardProvider {
  export type State = DrawerVirtualKeyboardProviderState;
  export type Props = DrawerVirtualKeyboardProviderProps;
}

function isKeyboardInputElement(element: HTMLElement): boolean {
  if (element.isContentEditable) {
    return true;
  }

  const win = ownerWindow(element);

  if (
    element instanceof win.HTMLTextAreaElement ||
    (element instanceof win.HTMLInputElement && KEYBOARD_INPUT_TYPES.has(element.type))
  ) {
    // Disabled controls can't focus or open the keyboard, so tap-to-focus must skip them —
    // otherwise the dispatched click fires handlers a native tap on a disabled control never would.
    return !element.matches(':disabled');
  }

  return false;
}

function resolveKeyboardInputTarget(target: EventTarget | null): HTMLElement | null {
  if (!isHTMLElement(target)) {
    return null;
  }

  if (isKeyboardInputElement(target)) {
    return target.isContentEditable ? getContentEditableHost(target) : target;
  }

  const label = target.closest('label') as HTMLLabelElement | null;
  const control = label?.control ?? null;

  return isHTMLElement(control) && isKeyboardInputElement(control) ? control : null;
}

function resolveKeyboardTouchTarget(target: EventTarget | null): KeyboardTouchTarget | null {
  if (!isHTMLElement(target)) {
    return null;
  }

  const focusTarget = resolveKeyboardInputTarget(target);
  if (!focusTarget) {
    return null;
  }

  return {
    focusTarget,
    clickTarget: target,
  };
}

// Inherited-editable descendants (no `contenteditable` attribute of their own) are not
// focusable, so focusing them is a no-op; resolve taps on them to the editing host.
function getContentEditableHost(element: HTMLElement): HTMLElement {
  let host = element;
  while (host.parentElement?.isContentEditable) {
    host = host.parentElement;
  }
  return host;
}

function resolveKeyboardTouchTargetFromPoint(
  root: Node,
  clientX: number,
  clientY: number,
): KeyboardTouchTarget | typeof KEYBOARD_TAP_BLOCKED | null {
  const exactTarget = getElementAtPoint(root, clientX, clientY);
  if (isHTMLElement(exactTarget)) {
    const exactKeyboardTarget = resolveKeyboardInputTarget(exactTarget);
    if (exactKeyboardTarget) {
      return {
        focusTarget: exactKeyboardTarget,
        clickTarget: exactTarget,
      };
    }
  }

  // Probing nearby points compensates for iOS retargeting taps while the page reacts
  // to the keyboard, but it must not steal a tap that lands on another interactive
  // element. Returning the blocked sentinel (rather than `null`) stops the caller from
  // falling back to the touchstart target, which would re-steal the very tap rejected here.
  if (isInteractiveElement(exactTarget) || exactTarget?.closest('label') != null) {
    return KEYBOARD_TAP_BLOCKED;
  }

  for (const [offsetX, offsetY] of [
    [0, INPUT_TAP_HIT_SLOP],
    [0, -INPUT_TAP_HIT_SLOP],
    [INPUT_TAP_HIT_SLOP, 0],
    [-INPUT_TAP_HIT_SLOP, 0],
  ]) {
    const keyboardTarget = resolveKeyboardInputTarget(
      getElementAtPoint(root, clientX + offsetX, clientY + offsetY),
    );

    if (keyboardTarget) {
      return {
        focusTarget: keyboardTarget,
        clickTarget: keyboardTarget,
      };
    }
  }

  return null;
}

function dispatchKeyboardClick(target: HTMLElement, touch: Pick<Touch, 'clientX' | 'clientY'>) {
  const win = ownerWindow(target);
  const ClickEvent = win.PointerEvent ?? win.MouseEvent;

  target.dispatchEvent(
    new ClickEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: touch.clientX,
      clientY: touch.clientY,
      detail: 1,
      view: win,
    }),
  );
}

function focusKeyboardInputWithoutPageScroll(target: HTMLElement) {
  const wasFocused = activeElement(ownerDocument(target)) === target;
  // iOS Safari can still scroll the page for transformed sheets even with preventScroll.
  // Move the input off-screen only for the synchronous focus call.
  const restoreStyles = overrideGeometryDuringFocus(target, -2000);
  try {
    if (wasFocused) {
      target.blur();
    }
    target.focus({ preventScroll: true });
  } finally {
    restoreStyles();
  }
}

// Overrides the painted geometry WebKit samples when an element gains focus. The rect is
// hidden (opacity) rather than detached so layout is unaffected; the caller must restore
// synchronously before the next paint.
function overrideGeometryDuringFocus(target: HTMLElement, translateY: number): () => void {
  const previousOpacity = target.style.opacity;
  const previousTransform = target.style.transform;
  const previousTransition = target.style.transition;

  target.style.transition = 'none';
  target.style.opacity = '0';
  target.style.transform = `translateY(${translateY}px)`;

  return () => {
    target.style.opacity = previousOpacity;
    target.style.transform = previousTransform;
    target.style.transition = previousTransition;
  };
}

function findKeyboardScrollTarget(target: HTMLElement, root: HTMLElement): HTMLElement | null {
  // Start at the parent: scrolling the focused field's own content can never move its box
  // out from under the keyboard. Prefer an already-scrollable ancestor, then fall back to one
  // that only becomes scrollable once keyboard slack is added.
  const scrollStart = getParentNode(target);
  return (
    findScrollableTouchTarget(scrollStart, root, 'vertical') ??
    findScrollableTouchTarget(scrollStart, root, 'vertical', true)
  );
}

function getKeyboardVisualViewport(win: Window): KeyboardVisualViewport | null {
  const visualViewport = win.visualViewport;

  if (!visualViewport || visualViewport.scale !== 1) {
    return null;
  }

  const reducedHeight = win.innerHeight - visualViewport.height;
  // Treat small viewport changes as browser chrome movement, not the software keyboard.
  if (reducedHeight <= KEYBOARD_RESIZE_THRESHOLD) {
    return null;
  }

  const top = Math.max(0, visualViewport.offsetTop);
  return {
    top,
    bottom: Math.min(win.innerHeight, top + visualViewport.height),
  };
}
