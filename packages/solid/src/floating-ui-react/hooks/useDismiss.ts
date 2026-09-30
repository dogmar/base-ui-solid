/* eslint-disable no-underscore-dangle */
import { createEffect, createMemo, onCleanup, untrack } from 'solid-js';
import { addEventListener } from '@base-ui/utils/addEventListener';
import { mergeCleanups } from '@base-ui/utils/mergeCleanups';
import { ownerDocument } from '@base-ui/utils/owner';
import { Timeout } from '@base-ui/utils/useTimeout';
import {
  getComputedStyle,
  getParentNode,
  isElement,
  isHTMLElement,
  isLastTraversableNode,
  isShadowRoot,
} from '@floating-ui/utils/dom';
import { platform } from '@base-ui/utils/platform';
import { useTimeout } from '../../solid-utils/timers';
import { useFloatingTree } from '../components/FloatingTree';
import { FloatingTreeStore } from '../components/FloatingTreeStore';
import type { ElementProps, FloatingContext, FloatingRootContext } from '../types';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { FloatingUIOpenChangeDetails, HTMLProps } from '../../internals/types';
import { REASONS } from '../../internals/reasons';
import { createAttribute } from '../utils/createAttribute';
import { contains, getTarget, isEventTargetWithin, isRootElement } from '../utils/element';
import { isVirtualClick } from '../utils/event';
import { getNodeChildren } from '../utils/nodes';

type PressType = 'intentional' | 'sloppy';

function alwaysFalse() {
  return false;
}

export function normalizeProp(
  normalizable?: boolean | { escapeKey?: boolean | undefined; outsidePress?: boolean | undefined },
) {
  return {
    escapeKey:
      typeof normalizable === 'boolean' ? normalizable : (normalizable?.escapeKey ?? false),
    outsidePress:
      typeof normalizable === 'boolean' ? normalizable : (normalizable?.outsidePress ?? true),
  };
}

/**
 * Walks up the Solid component tree from `target`, following the `_$host`
 * links that `Portal` assigns to portaled nodes (plus regular DOM parents and
 * shadow hosts), to determine whether `target` is rendered inside `root`'s
 * subtree even when it is portaled elsewhere in the DOM.
 *
 * The React version relies on React's synthetic events propagating through
 * portals (capture-phase handlers from `getFloatingProps`); Solid dispatches
 * native events only, so tree membership is computed structurally instead.
 */
function isTargetWithinSolidSubtree(
  root: Element | null | undefined,
  target: EventTarget | null | undefined,
): boolean {
  if (!root || !target) {
    return false;
  }

  let node = target as
    | (Node & { _$host?: Node | undefined; host?: Node | string | undefined })
    | null
    | undefined;

  while (node) {
    if (node === root) {
      return true;
    }
    const host = typeof node.host === 'string' ? undefined : node.host;
    node = (node._$host || node.parentNode || host) as typeof node;
  }

  return false;
}

export interface UseDismissProps {
  /**
   * Whether the Hook is enabled, including all internal Effects and event
   * handlers.
   * @default true
   */
  enabled?: boolean | undefined;
  /**
   * Whether to dismiss the floating element upon pressing the `esc` key.
   * @default true
   */
  escapeKey?: boolean | undefined;
  /**
   * Whether to dismiss the floating element upon pressing the reference
   * element. You likely want to ensure the `move` option in the `useHover()`
   * Hook has been disabled when this is in use.
   *
   * A lazy getter invoked when handling reference press events.
   * @default false
   */
  referencePress?: (() => boolean) | undefined;
  /**
   * Whether to dismiss the floating element upon pressing outside of the
   * floating element.
   * If you have another element, like a toast, that is rendered outside the
   * floating element's React tree and don't want the floating element to close
   * when pressing it, you can guard the check like so:
   * ```jsx
   * useDismiss(context, {
   *   outsidePress: (event) => !event.target.closest('.toast'),
   * });
   * ```
   * @default true
   */
  outsidePress?: boolean | ((event: MouseEvent | TouchEvent) => boolean) | undefined;
  /**
   * The type of event to use to determine an outside "press".
   * - `intentional` dismisses on an outside `click` whose press began while the floating element was open, ignoring the trailing click of a press that started before it opened. Touch requires minimal `touchmove`s, and press-less clicks (keyboard, assistive technology) are always accepted.
   * - `sloppy` fires on `pointerdown` for mouse, while for touch it fires on `touchend` (within 1 second) or while scrolling away after `touchstart`.
   */
  outsidePressEvent?:
    | PressType
    | {
        mouse: PressType;
        touch: PressType;
      }
    | (() =>
        | PressType
        | {
            mouse: PressType;
            touch: PressType;
          })
    | undefined;
  /**
   * Determines whether event listeners bubble upwards through a tree of
   * floating elements.
   */
  bubbles?:
    | boolean
    | { escapeKey?: boolean | undefined; outsidePress?: boolean | undefined }
    | undefined;
  /**
   * External FloatingTree to use when the one provided by context can't be used.
   */
  externalTree?: FloatingTreeStore | undefined;
}

/**
 * Closes the floating element when a dismissal is requested — by default, when
 * the user presses the `escape` key or outside of the floating element.
 *
 * Solid port notes: `props` should be a reactive object (use getters for
 * reactive values); the option values are read lazily. React's capture-phase
 * `getFloatingProps` handlers (which mark events as being inside the floating
 * tree before the document listeners' one-shot target listener runs) are
 * replaced with equivalent marking performed from the document capture
 * listeners themselves, using a Solid-tree-aware containment check.
 * @see https://floating-ui.com/docs/useDismiss
 */
export function useDismiss(
  context: FloatingRootContext | FloatingContext,
  props: UseDismissProps = {},
): ElementProps {
  const enabled = () => props.enabled ?? true;
  const escapeKey = () => props.escapeKey ?? true;
  const outsidePressProp = () => props.outsidePress ?? true;
  const getOutsidePressEventProp = () => props.outsidePressEvent ?? 'sloppy';
  const referencePress = () => props.referencePress ?? alwaysFalse;

  const store = 'rootStore' in context ? context.rootStore : context;

  const open = store.useState('open');
  const floatingElement = store.useState('floatingElement');
  const { dataRef, events } = store.context;

  const tree = useFloatingTree(untrack(() => props.externalTree));

  const outsidePressEnabled = () => outsidePressProp() !== false;

  const escapeKeyBubbles = () => normalizeProp(props.bubbles).escapeKey;
  const outsidePressBubbles = () => normalizeProp(props.bubbles).outsidePress;

  let pressStartedInside = false;
  let pressStartPrevented = false;
  // Ignore only the very next outside click after dragging from inside to outside.
  let suppressNextOutsideClick = false;
  // A click whose press began before the floating element opened is the tail of that
  // gesture (e.g. the drag-release that opened it), not a new outside press.
  let sawPressWhileOpen = false;
  let isComposing = false;
  let currentPointerType: PointerEvent['pointerType'] = '';

  let touchState: {
    startTime: number;
    startX: number;
    startY: number;
    dismissOnTouchEnd: boolean;
    dismissOnMouseDown: boolean;
  } | null = null;

  const cancelDismissOnEndTimeout = useTimeout();
  const clearInsideReactTreeTimeout = useTimeout();

  const clearInsideReactTree = () => {
    clearInsideReactTreeTimeout.clear();
    dataRef.current.insideReactTree = false;
  };

  const hasBlockingChild = (bubbleKey: '__escapeKeyBubbles' | '__outsidePressBubbles') => {
    const nodeId = dataRef.current.floatingContext?.nodeId();
    const children = tree ? getNodeChildren(tree.nodesRef.current, nodeId) : [];

    return children.some(
      (child) => child.context?.open() && !child.context.dataRef.current[bubbleKey],
    );
  };

  const isEventWithinOwnElements = (event: Event) => {
    return (
      isEventTargetWithin(event, store.select('floatingElement')) ||
      isEventTargetWithin(event, store.select('domReferenceElement'))
    );
  };

  const closeOnReferencePress = (event: MouseEvent | PointerEvent) => {
    if (!referencePress()()) {
      return;
    }

    store.setOpen(false, createChangeEventDetails(REASONS.triggerPress, event));
  };

  const closeOnEscapeKeyDown = (event: KeyboardEvent) => {
    if (!open() || !enabled() || !escapeKey() || event.key !== 'Escape') {
      return;
    }

    // Wait until IME is settled. Pressing `Escape` while composing should
    // close the compose menu, but not the floating element.
    if (isComposing) {
      return;
    }

    if (!escapeKeyBubbles() && hasBlockingChild('__escapeKeyBubbles')) {
      return;
    }

    const eventDetails = createChangeEventDetails(REASONS.escapeKey, event);

    store.setOpen(false, eventDetails);

    if (!eventDetails.isCanceled) {
      event.preventDefault();
    }

    if (!escapeKeyBubbles() && !eventDetails.isPropagationAllowed) {
      event.stopPropagation();
    }
  };

  const markInsideReactTree = () => {
    dataRef.current.insideReactTree = true;
    clearInsideReactTreeTimeout.start(0, clearInsideReactTree);
  };

  const markPressStartedInsideReactTree = (event: PointerEvent | MouseEvent) => {
    if (!open() || !enabled() || event.button !== 0) {
      return;
    }

    const target = getTarget(event) as Element | null;

    // Only treat presses that start within the floating DOM subtree as inside.
    // This avoids suppressing parent dismissal when interacting with nested portals.
    if (!contains(store.select('floatingElement'), target)) {
      return;
    }

    if (!pressStartedInside) {
      pressStartedInside = true;
      pressStartPrevented = false;
    }
  };

  const markInsidePressStartPrevented = (event: PointerEvent | MouseEvent) => {
    if (!open() || !enabled()) {
      return;
    }

    if (!event.defaultPrevented) {
      return;
    }

    if (pressStartedInside) {
      pressStartPrevented = true;
    }
  };

  // A same-batch close+reopen never renders `open === false`, so only `openchange` can
  // observe that session boundary. The effect below covers controlled flips.
  function handleOpenChange(details: FloatingUIOpenChangeDetails) {
    // Only the closing half ends the session: `setOpen(true)` on an already-open
    // element (hovering an inactive trigger) must not drop a press mid-gesture.
    if (!details.open) {
      sawPressWhileOpen = false;
    }
  }
  events.on('openchange', handleOpenChange);
  onCleanup(() => {
    events.off('openchange', handleOpenChange);
  });

  // Mirrors the React effect's dependency array: the apply phase only re-runs
  // when one of these values actually changes (`Object.is` per entry), so the
  // document listeners are not detached/re-attached (and the press-tracking
  // state is not reset) mid-gesture when unrelated store state changes.
  const listenerDeps = createMemo(
    () => ({
      open: open(),
      enabled: enabled(),
      escapeKey: escapeKey(),
      outsidePressEnabled: outsidePressEnabled(),
      floatingElement: floatingElement(),
      escapeKeyBubbles: escapeKeyBubbles(),
      outsidePressBubbles: outsidePressBubbles(),
    }),
    {
      equals: (a, b) =>
        a.open === b.open &&
        a.enabled === b.enabled &&
        a.escapeKey === b.escapeKey &&
        a.outsidePressEnabled === b.outsidePressEnabled &&
        a.floatingElement === b.floatingElement &&
        a.escapeKeyBubbles === b.escapeKeyBubbles &&
        a.outsidePressBubbles === b.outsidePressBubbles,
    },
  );

  createEffect(
    () => listenerDeps(),
    (current) => {
      if (!current.open || !current.enabled) {
        // Reset in the effect body, not the cleanup, which also runs when a dependency
        // changes mid-gesture.
        if (!current.open) {
          sawPressWhileOpen = false;
        }
        return clearInsideReactTree;
      }

      dataRef.current.__escapeKeyBubbles = current.escapeKeyBubbles;
      dataRef.current.__outsidePressBubbles = current.outsidePressBubbles;

      const compositionTimeout = new Timeout();
      const preventedPressSuppressionTimeout = new Timeout();
      const doc = ownerDocument(current.floatingElement);

      function handleCompositionStart() {
        compositionTimeout.clear();
        isComposing = true;
      }

      function handleCompositionEnd() {
        // Safari fires `compositionend` before `keydown`, so we need to wait
        // until the next tick to set `isComposing` to `false`.
        // https://bugs.webkit.org/show_bug.cgi?id=165004
        compositionTimeout.start(
          // 0ms or 1ms don't work in Safari. 5ms appears to consistently work.
          // Only apply to WebKit for the test to remain 0ms.
          platform.engine.webkit ? 5 : 0,
          () => {
            isComposing = false;
          },
        );
      }

      function suppressImmediateOutsideClickAfterPreventedStart() {
        suppressNextOutsideClick = true;
        // Firefox can emit the synthetic outside click in a later task after
        // pointer lock exit, so microtask clearing is too early here.
        preventedPressSuppressionTimeout.start(0, () => {
          suppressNextOutsideClick = false;
        });
      }

      function resetPressStartState() {
        pressStartedInside = false;
        pressStartPrevented = false;
      }

      function getOutsidePressEvent(): PressType {
        const type = currentPointerType as 'pen' | 'mouse' | 'touch' | '';
        const computedType = type === 'pen' || !type ? 'mouse' : type;

        const outsidePressEventValue = getOutsidePressEventProp();
        const resolved =
          typeof outsidePressEventValue === 'function'
            ? outsidePressEventValue()
            : outsidePressEventValue;

        if (typeof resolved === 'string') {
          return resolved;
        }

        return resolved[computedType];
      }

      function shouldIgnoreEvent(event: Event) {
        const computedOutsidePressEvent = getOutsidePressEvent();
        return (
          (computedOutsidePressEvent === 'intentional' && event.type !== 'click') ||
          (computedOutsidePressEvent === 'sloppy' && event.type === 'click')
        );
      }

      function isEventWithinFloatingTree(event: Event) {
        const nodeId = dataRef.current.floatingContext?.nodeId();
        const targetIsInsideChildren =
          tree &&
          getNodeChildren(tree.nodesRef.current, nodeId).some((node) =>
            isEventTargetWithin(event, node.context?.elements.floating()),
          );

        return isEventWithinOwnElements(event) || targetIsInsideChildren;
      }

      // React marks events that pass through the floating element's React tree
      // via capture-phase handlers in `getFloatingProps`. Solid's equivalent
      // runs from the document capture listeners below, before the one-shot
      // target listener fires, using a portal-aware containment check.
      function markEventInsideTree(event: Event) {
        if (
          isTargetWithinSolidSubtree(
            store.select('floatingElement'),
            getTarget(event) as Element | null,
          )
        ) {
          markInsideReactTree();
          return true;
        }
        return false;
      }

      function closeOnPressOutside(event: MouseEvent | PointerEvent | TouchEvent) {
        if (shouldIgnoreEvent(event)) {
          // A new press began outside the floating element and its trigger. Clear any
          // leftover drag-out suppression so this press's eventual click can dismiss.
          if (event.type !== 'click' && !isEventWithinOwnElements(event)) {
            preventedPressSuppressionTimeout.clear();
            suppressNextOutsideClick = false;
          }
          clearInsideReactTree();
          return;
        }

        if (dataRef.current.insideReactTree) {
          clearInsideReactTree();
          return;
        }

        const target = getTarget(event);
        const inertSelector = `[${createAttribute('inert')}]`;
        const targetRoot = isElement(target) ? target.getRootNode() : null;
        const markers = Array.from(
          (isShadowRoot(targetRoot)
            ? targetRoot
            : ownerDocument(store.select('floatingElement'))
          ).querySelectorAll(inertSelector),
        );

        const triggers = store.context.triggerElements;

        // If another trigger is clicked, don't close the floating element.
        if (
          target &&
          (triggers.hasElement(target as Element) ||
            triggers.hasMatchingElement((trigger) => contains(trigger, target as Element)))
        ) {
          return;
        }

        let targetRootAncestor = isElement(target) ? target : null;
        while (targetRootAncestor && !isLastTraversableNode(targetRootAncestor)) {
          const nextParent = getParentNode(targetRootAncestor);
          if (isLastTraversableNode(nextParent) || !isElement(nextParent)) {
            break;
          }

          targetRootAncestor = nextParent;
        }

        // Check if the click occurred on a third-party element injected after the
        // floating element rendered.
        if (
          markers.length &&
          isElement(target) &&
          !isRootElement(target) &&
          // Clicked on a direct ancestor (e.g. FloatingOverlay).
          !contains(target, store.select('floatingElement')) &&
          // If the target root element contains none of the markers, then the
          // element was injected after the floating element rendered.
          markers.every((marker) => !contains(targetRootAncestor, marker))
        ) {
          return;
        }

        // Check if the click occurred on the scrollbar
        // Skip for touch events: scrollbars don't receive touch events on most platforms
        if (isHTMLElement(target) && !('touches' in event)) {
          const lastTraversableNode = isLastTraversableNode(target);
          const style = getComputedStyle(target);
          const scrollRe = /auto|scroll/;
          const isScrollableX = lastTraversableNode || scrollRe.test(style.overflowX);
          const isScrollableY = lastTraversableNode || scrollRe.test(style.overflowY);

          const canScrollX =
            isScrollableX && target.clientWidth > 0 && target.scrollWidth > target.clientWidth;
          const canScrollY =
            isScrollableY && target.clientHeight > 0 && target.scrollHeight > target.clientHeight;

          const isRTL = style.direction === 'rtl';

          // Check click position relative to scrollbar.
          // In some browsers it is possible to change the <body> (or window)
          // scrollbar to the left side, but is very rare and is difficult to
          // check for. Plus, for modal dialogs with backdrops, it is more
          // important that the backdrop is checked but not so much the window.
          const pressedVerticalScrollbar =
            canScrollY &&
            (isRTL
              ? event.offsetX <= target.offsetWidth - target.clientWidth
              : event.offsetX > target.clientWidth);

          const pressedHorizontalScrollbar = canScrollX && event.offsetY > target.clientHeight;

          if (pressedVerticalScrollbar || pressedHorizontalScrollbar) {
            return;
          }
        }

        if (isEventWithinFloatingTree(event)) {
          return;
        }

        // Only `click` events reach this point in intentional mode.
        if (getOutsidePressEvent() === 'intentional') {
          // Press-less clicks (keyboard, assistive technology, `element.click()`) report no
          // click count; `isVirtualClick` also catches the ones that do.
          if (
            (event as MouseEvent).detail !== 0 &&
            !isVirtualClick(event as MouseEvent) &&
            !sawPressWhileOpen
          ) {
            return;
          }

          // A press that starts inside and ends outside gets one suppressed
          // outside click. Run this after inside-target checks so inside clicks
          // don't consume the one-shot suppression.
          if (suppressNextOutsideClick) {
            preventedPressSuppressionTimeout.clear();
            suppressNextOutsideClick = false;
            return;
          }
        }

        const outsidePress = untrack(outsidePressProp);
        if (typeof outsidePress === 'function' && !outsidePress(event)) {
          return;
        }

        if (hasBlockingChild('__outsidePressBubbles')) {
          return;
        }

        store.setOpen(false, createChangeEventDetails(REASONS.outsidePress, event));
        clearInsideReactTree();
      }

      function handlePointerDown(event: PointerEvent) {
        if (
          getOutsidePressEvent() !== 'sloppy' ||
          event.pointerType === 'touch' ||
          !store.select('open') ||
          !current.enabled ||
          isEventWithinOwnElements(event)
        ) {
          return;
        }

        closeOnPressOutside(event);
      }

      function handleTouchStart(event: TouchEvent) {
        if (
          getOutsidePressEvent() !== 'sloppy' ||
          !store.select('open') ||
          !current.enabled ||
          isEventWithinOwnElements(event)
        ) {
          return;
        }

        const touch = event.touches[0];
        if (touch) {
          touchState = {
            startTime: Date.now(),
            startX: touch.clientX,
            startY: touch.clientY,
            dismissOnTouchEnd: false,
            dismissOnMouseDown: true,
          };

          cancelDismissOnEndTimeout.start(1000, () => {
            if (touchState) {
              touchState.dismissOnTouchEnd = false;
              touchState.dismissOnMouseDown = false;
            }
          });
        }
      }

      function addTargetEventListenerOnce<EventType extends Event>(
        event: EventType,
        listener: (event: EventType) => void,
      ) {
        const target = getTarget(event);

        if (!target) {
          return;
        }

        const unsubscribe = addEventListener(target as Element, event.type as never, () => {
          listener(event);
          unsubscribe();
        });
      }

      function handleTouchStartCapture(event: TouchEvent) {
        currentPointerType = 'touch';
        addTargetEventListenerOnce(event, handleTouchStart);
      }

      function closeOnPressOutsideCapture(event: PointerEvent | MouseEvent) {
        cancelDismissOnEndTimeout.clear();

        // Only `pointerdown` marks a press; `mousedown` is its compatibility event, and
        // counting it would misattribute a gesture that started before open.
        if (event.type === 'pointerdown') {
          // Only a primary press can produce a `click`.
          if (event.button === 0) {
            sawPressWhileOpen = true;
          }
          currentPointerType = (event as PointerEvent).pointerType;
        }

        // Solid equivalent of React's `onClickCapture`/`onMouseDownCapture`/
        // `onPointerDownCapture` handlers on the floating element.
        if (markEventInsideTree(event)) {
          if (event.type === 'pointerdown' || event.type === 'mousedown') {
            markPressStartedInsideReactTree(event);
          }
        }

        if (event.type === 'mousedown' && touchState && !touchState.dismissOnMouseDown) {
          return;
        }

        addTargetEventListenerOnce(event, (targetEvent) => {
          if (targetEvent.type === 'pointerdown') {
            handlePointerDown(targetEvent as PointerEvent);
          } else {
            closeOnPressOutside(targetEvent as MouseEvent);
          }
        });
      }

      function handlePressEndCapture(event: PointerEvent | MouseEvent) {
        // A cancelled gesture produces no click. Not cleared on `pointerup`: the click
        // fires after it and must still find the press.
        if (event.type === 'pointercancel') {
          sawPressWhileOpen = false;
        }

        // Solid equivalent of React's `onMouseUpCapture` marker on the
        // floating element.
        if (event.type === 'mouseup') {
          markEventInsideTree(event);
        }

        if (!pressStartedInside) {
          return;
        }

        const pressStartedInsideDefaultPrevented = pressStartPrevented;
        resetPressStartState();

        if (getOutsidePressEvent() !== 'intentional') {
          return;
        }

        if (event.type === 'pointercancel') {
          if (pressStartedInsideDefaultPrevented) {
            suppressImmediateOutsideClickAfterPreventedStart();
          }
          return;
        }

        if (isEventWithinFloatingTree(event)) {
          return;
        }

        // If pointerdown was prevented, no click may be generated for that
        // interaction. However, Firefox may still emit an immediate click after
        // pointerup (e.g. NumberField scrub with pointer lock), so suppress for
        // one tick to absorb that synthetic click only.
        if (pressStartedInsideDefaultPrevented) {
          suppressImmediateOutsideClickAfterPreventedStart();
          return;
        }

        // Avoid suppressing when outsidePress explicitly ignores this target.
        const outsidePress = untrack(outsidePressProp);
        if (typeof outsidePress === 'function' && !outsidePress(event as MouseEvent)) {
          return;
        }

        preventedPressSuppressionTimeout.clear();
        suppressNextOutsideClick = true;
        clearInsideReactTree();
      }

      function handleTouchMove(event: TouchEvent) {
        if (
          getOutsidePressEvent() !== 'sloppy' ||
          !touchState ||
          isEventWithinOwnElements(event)
        ) {
          return;
        }

        const touch = event.touches[0];
        if (!touch) {
          return;
        }

        const deltaX = Math.abs(touch.clientX - touchState.startX);
        const deltaY = Math.abs(touch.clientY - touchState.startY);
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (distance > 5) {
          touchState.dismissOnTouchEnd = true;
        }

        if (distance > 10) {
          closeOnPressOutside(event);
          cancelDismissOnEndTimeout.clear();
          touchState = null;
        }
      }

      function handleTouchMoveCapture(event: TouchEvent) {
        // Solid equivalent of React's `onTouchMoveCapture` marker.
        markEventInsideTree(event);
        addTargetEventListenerOnce(event, handleTouchMove);
      }

      function handleTouchEnd(event: TouchEvent) {
        if (
          getOutsidePressEvent() !== 'sloppy' ||
          !touchState ||
          isEventWithinOwnElements(event)
        ) {
          return;
        }

        if (touchState.dismissOnTouchEnd) {
          closeOnPressOutside(event);
        }

        cancelDismissOnEndTimeout.clear();
        touchState = null;
      }

      function handleTouchEndCapture(event: TouchEvent) {
        // Solid equivalent of React's `onTouchEndCapture` marker.
        markEventInsideTree(event);
        addTargetEventListenerOnce(event, handleTouchEnd);
      }

      const unsubscribe = mergeCleanups(
        current.escapeKey &&
          mergeCleanups(
            addEventListener(doc, 'keydown', closeOnEscapeKeyDown),
            addEventListener(doc, 'compositionstart', handleCompositionStart),
            addEventListener(doc, 'compositionend', handleCompositionEnd),
          ),
        current.outsidePressEnabled &&
          mergeCleanups(
            addEventListener(doc, 'click', closeOnPressOutsideCapture, true),
            addEventListener(doc, 'pointerdown', closeOnPressOutsideCapture, true),
            addEventListener(doc, 'pointerup', handlePressEndCapture, true),
            addEventListener(doc, 'pointercancel', handlePressEndCapture, true),
            addEventListener(doc, 'mousedown', closeOnPressOutsideCapture, true),
            addEventListener(doc, 'mouseup', handlePressEndCapture, true),
            addEventListener(doc, 'touchstart', handleTouchStartCapture, {
              capture: true,
              passive: true,
            }),
            addEventListener(doc, 'touchmove', handleTouchMoveCapture, {
              capture: true,
              passive: true,
            }),
            addEventListener(doc, 'touchend', handleTouchEndCapture, {
              capture: true,
              passive: true,
            }),
          ),
      );

      return () => {
        unsubscribe();
        compositionTimeout.clear();
        preventedPressSuppressionTimeout.clear();
        resetPressStartState();
        suppressNextOutsideClick = false;
        clearInsideReactTree();
      };
    },
  );

  const referenceProps: HTMLProps = {
    onKeyDown: closeOnEscapeKeyDown,
    onPointerDown: closeOnReferencePress,
    onClick: closeOnReferencePress,
  };

  const floatingProps: HTMLProps = {
    onKeyDown: closeOnEscapeKeyDown,
    // `onMouseDown` may be blocked if `event.preventDefault()` is called in
    // `onPointerDown`, such as with <NumberField.ScrubArea>.
    // See https://github.com/mui/base-ui/pull/3379
    onPointerDown: markInsidePressStartPrevented,
    onMouseDown: markInsidePressStartPrevented,
    // The React version also attaches capture-phase handlers here
    // (`onClickCapture`, `onMouseDownCapture`, `onPointerDownCapture`,
    // `onMouseUpCapture`, `onTouchEndCapture`, `onTouchMoveCapture`) to mark
    // events inside the floating tree. Solid has no capture-phase JSX
    // handlers, so that marking runs from the document capture listeners in
    // the effect above instead.
  };

  return {
    get reference() {
      return enabled() ? referenceProps : undefined;
    },
    get floating() {
      return enabled() ? floatingProps : undefined;
    },
    get trigger() {
      return enabled() ? referenceProps : undefined;
    },
  };
}
