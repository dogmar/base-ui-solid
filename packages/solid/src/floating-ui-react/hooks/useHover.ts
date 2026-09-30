import { createEffect, createRenderEffect, onCleanup } from 'solid-js';
import { addEventListener } from '@base-ui/utils/addEventListener';
import { mergeCleanups } from '@base-ui/utils/mergeCleanups';
import { ownerDocument } from '@base-ui/utils/owner';
import { isElement } from '@floating-ui/utils/dom';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { FloatingUIOpenChangeDetails } from '../../internals/types';
import { useFloatingParentNodeId, useFloatingTree } from '../components/FloatingTree';
import type { Delay, ElementProps, FloatingContext, FloatingRootContext } from '../types';
import { useTimeout } from '../../solid-utils/timers';
import { contains, getTarget, isInteractiveElement } from '../utils/element';
import type { HandleClose } from './useHoverShared';
import {
  getDelay,
  getRestMs,
  isClickLikeOpenEvent as isClickLikeOpenEventShared,
  isHoverOpenEvent,
} from './useHoverShared';

export type { HandleCloseContext, HandleClose } from './useHoverShared';

export interface UseHoverProps {
  /**
   * Accepts an event handler that runs on `mousemove` to control when the
   * floating element closes once the cursor leaves the reference element.
   * @default null
   */
  handleClose?: HandleClose | null | undefined;
  /**
   * Waits until the user's cursor is at “rest” over the reference element
   * before changing the `open` state.
   * @default 0
   */
  restMs?: number | (() => number) | undefined;
  /**
   * Waits for the specified time when the event listener runs before changing
   * the `open` state.
   * @default 0
   */
  delay?: Delay | (() => Delay) | undefined;
  /**
   * Whether moving the cursor over the floating element will open it, without a
   * regular hover event required.
   * @default true
   */
  move?: boolean | undefined;
}

/**
 * Opens the floating element while hovering over the reference element, like
 * CSS `:hover`.
 *
 * Solid port notes: `props` should be a reactive object (use getters for
 * reactive values); the option values are read lazily, mirroring the React
 * version's `useValueAsRef` semantics.
 * @see https://floating-ui.com/docs/useHover
 */
export function useHover(
  context: FloatingRootContext | FloatingContext,
  props: UseHoverProps = {},
): ElementProps {
  const delayOption = () => props.delay ?? 0;
  const handleCloseOption = () => props.handleClose ?? null;
  const restMsOption = () => props.restMs ?? 0;
  const moveOption = () => props.move ?? true;

  const store = 'rootStore' in context ? context.rootStore : context;

  const open = store.useState('open');
  const floatingElement = store.useState('floatingElement');
  const domReferenceElement = store.useState('domReferenceElement');
  const { dataRef, events } = store.context;

  const tree = useFloatingTree();
  const parentId = useFloatingParentNodeId();

  let pointerType: string | undefined;
  let interactedInside = false;
  let handler: ((event: MouseEvent) => void) | undefined;
  let blockMouseMove = true;
  let performedPointerEventsMutation = false;
  let unbindMouseMove = () => {};
  let restTimeoutPending = false;

  const timeout = useTimeout();
  const restTimeout = useTimeout();

  const isHoverOpen = () => {
    return isHoverOpenEvent(dataRef.current.openEvent?.type);
  };

  const isClickLikeOpenEvent = () => {
    return isClickLikeOpenEventShared(dataRef.current.openEvent?.type, interactedInside);
  };

  const cleanupMouseMoveHandler = () => {
    unbindMouseMove();
    handler = undefined;
  };

  const clearPointerEvents = () => {
    if (performedPointerEventsMutation) {
      const body = ownerDocument(store.state.floatingElement).body;
      body.style.pointerEvents = '';
      performedPointerEventsMutation = false;
    }
  };

  // When closing before opening, clear the delay timeouts to cancel it
  // from showing. (`events`, `timeout` and `restTimeout` are stable, so this
  // runs once for the component's lifetime.)
  function onOpenChangeLocal(details: FloatingUIOpenChangeDetails) {
    if (!details.open) {
      timeout.clear();
      restTimeout.clear();
      blockMouseMove = true;
      restTimeoutPending = false;
    }
  }
  events.on('openchange', onOpenChangeLocal);
  void onCleanup(() => {
    events.off('openchange', onOpenChangeLocal);
  });

  createEffect(
    () => ({ floating: floatingElement(), open: open() }),
    ({ floating, open: isOpen }) => {
      if (!handleCloseOption()) {
        return undefined;
      }

      if (!isOpen) {
        return undefined;
      }

      function onLeave(event: MouseEvent) {
        if (isClickLikeOpenEvent()) {
          return;
        }

        if (isHoverOpen()) {
          store.setOpen(
            false,
            createChangeEventDetails(
              REASONS.triggerHover,
              event,
              (event.currentTarget as HTMLElement) ?? undefined,
            ),
          );
        }
      }

      const html = ownerDocument(floating).documentElement;
      return addEventListener(html, 'mouseleave', onLeave);
    },
  );

  // Registering the mouse events on the reference directly. If the cursor was
  // on a disabled element and then entered the reference (no gap),
  // `mouseenter` doesn't fire in a delegation system.
  createEffect(
    () => ({
      move: moveOption(),
      domReference: domReferenceElement(),
      floating: floatingElement(),
      open: open(),
    }),
    ({ move, domReference, floating, open: isOpen }) => {
      function closeWithDelay(event: MouseEvent, runElseBranch = true) {
        const closeDelay = getDelay(delayOption(), 'close', pointerType);
        if (closeDelay && !handler) {
          timeout.start(closeDelay, () =>
            store.setOpen(false, createChangeEventDetails(REASONS.triggerHover, event)),
          );
        } else if (runElseBranch) {
          timeout.clear();
          store.setOpen(false, createChangeEventDetails(REASONS.triggerHover, event));
        }
      }

      function handleInteractInside(event: PointerEvent) {
        const target = getTarget(event) as Element | null;
        if (!isInteractiveElement(target)) {
          interactedInside = false;
          return;
        }

        interactedInside = true;
      }

      function getHandleCloseHandler(event: MouseEvent, onClose: () => void) {
        const handleClose = handleCloseOption();
        if (!handleClose || !dataRef.current.floatingContext) {
          return null;
        }

        return handleClose({
          ...dataRef.current.floatingContext,
          tree,
          x: event.clientX,
          y: event.clientY,
          onClose,
        });
      }

      function onReferenceMouseEnter(event: MouseEvent) {
        timeout.clear();
        blockMouseMove = false;

        if (getRestMs(restMsOption()) > 0 && !getDelay(delayOption(), 'open')) {
          return;
        }

        const openDelay = getDelay(delayOption(), 'open', pointerType);
        const trigger = (event.currentTarget as HTMLElement) ?? undefined;

        const currentDomReference = store.select('domReferenceElement');

        const isOverInactiveTrigger =
          currentDomReference && trigger && !contains(currentDomReference, trigger);

        if (openDelay) {
          timeout.start(openDelay, () => {
            if (!store.select('open')) {
              store.setOpen(true, createChangeEventDetails(REASONS.triggerHover, event, trigger));
            }
          });
        } else if (!isOpen || isOverInactiveTrigger) {
          store.setOpen(true, createChangeEventDetails(REASONS.triggerHover, event, trigger));
        }
      }

      function onReferenceMouseLeave(event: MouseEvent) {
        if (isClickLikeOpenEvent()) {
          clearPointerEvents();
          return;
        }

        unbindMouseMove();

        const doc = ownerDocument(floating);
        restTimeout.clear();
        restTimeoutPending = false;

        const triggers = store.context.triggerElements;

        if (event.relatedTarget && triggers.hasElement(event.relatedTarget as Element)) {
          // If the mouse is leaving the reference element to another trigger, don't explicitly close the popup
          // as it will be moved.
          return;
        }

        const closeHandler = getHandleCloseHandler(event, () => {
          clearPointerEvents();
          cleanupMouseMoveHandler();
          if (!isClickLikeOpenEvent()) {
            closeWithDelay(event, true);
          }
        });

        if (closeHandler) {
          // Prevent clearing `onScrollMouseLeave` timeout.
          if (!isOpen) {
            timeout.clear();
          }

          handler = closeHandler;
          unbindMouseMove = addEventListener(doc, 'mousemove', closeHandler);

          return;
        }

        // Allow interactivity without `safePolygon` on touch devices. With a
        // pointer, a short close delay is an alternative, so it should work
        // consistently.
        const shouldClose =
          pointerType === 'touch'
            ? !contains(floating, event.relatedTarget as Element | null)
            : true;
        if (shouldClose) {
          closeWithDelay(event);
        }
      }

      // Ensure the floating element closes after scrolling even if the pointer
      // did not move.
      // https://github.com/floating-ui/floating-ui/discussions/1692
      function onScrollMouseLeave(event: MouseEvent) {
        if (isClickLikeOpenEvent() || !dataRef.current.floatingContext || !store.select('open')) {
          return;
        }

        const triggers = store.context.triggerElements;

        if (event.relatedTarget && triggers.hasElement(event.relatedTarget as Element)) {
          // If the mouse is leaving the reference element to another trigger, don't explicitly close the popup
          // as it will be moved.
          return;
        }

        getHandleCloseHandler(event, () => {
          clearPointerEvents();
          cleanupMouseMoveHandler();
          if (!isClickLikeOpenEvent()) {
            closeWithDelay(event);
          }
        })?.(event);
      }

      function onFloatingMouseEnter() {
        timeout.clear();
        clearPointerEvents();
      }

      function onFloatingMouseLeave(event: MouseEvent) {
        if (!isClickLikeOpenEvent()) {
          closeWithDelay(event, false);
        }
      }

      const trigger = domReference as HTMLElement | null;

      if (isElement(trigger)) {
        return mergeCleanups(
          isOpen && addEventListener(trigger, 'mouseleave', onScrollMouseLeave),
          move && addEventListener(trigger, 'mousemove', onReferenceMouseEnter, { once: true }),
          addEventListener(trigger, 'mouseenter', onReferenceMouseEnter),
          addEventListener(trigger, 'mouseleave', onReferenceMouseLeave),
          floating && addEventListener(floating, 'mouseleave', onScrollMouseLeave),
          floating && addEventListener(floating, 'mouseenter', onFloatingMouseEnter),
          floating && addEventListener(floating, 'mouseleave', onFloatingMouseLeave),
          floating && addEventListener(floating, 'pointerdown', handleInteractInside, true),
        );
      }

      return undefined;
    },
  );

  // Block pointer-events of every element other than the reference and floating
  // while the floating element is open and has a `handleClose` handler. Also
  // handles nested floating elements.
  // https://github.com/floating-ui/floating-ui/issues/1722
  createRenderEffect(
    () => ({
      open: open(),
      domReference: domReferenceElement(),
      floating: floatingElement(),
    }),
    ({ open: isOpen, domReference, floating }) => {
      // eslint-disable-next-line no-underscore-dangle
      if (isOpen && handleCloseOption()?.__options?.blockPointerEvents && isHoverOpen()) {
        performedPointerEventsMutation = true;
        const floatingEl = floating;

        if (isElement(domReference) && floatingEl) {
          const body = ownerDocument(floating).body;

          const ref = domReference as HTMLElement | SVGSVGElement;

          const parentFloating = tree?.nodesRef.current
            .find((node) => node.id === parentId)
            ?.context?.elements.floating();

          if (parentFloating) {
            parentFloating.style.pointerEvents = '';
          }

          body.style.pointerEvents = 'none';
          ref.style.pointerEvents = 'auto';
          floatingEl.style.pointerEvents = 'auto';

          return () => {
            body.style.pointerEvents = '';
            ref.style.pointerEvents = '';
            floatingEl.style.pointerEvents = '';
          };
        }
      }

      return undefined;
    },
  );

  createRenderEffect(
    () => open(),
    (isOpen) => {
      if (!isOpen) {
        pointerType = undefined;
        restTimeoutPending = false;
        interactedInside = false;
        cleanupMouseMoveHandler();
        clearPointerEvents();
      }
    },
  );

  createEffect(
    () => domReferenceElement(),
    () => {
      return () => {
        cleanupMouseMoveHandler();
        timeout.clear();
        restTimeout.clear();
        interactedInside = false;
      };
    },
  );

  void onCleanup(() => {
    clearPointerEvents();
  });

  function setPointerRef(event: PointerEvent) {
    pointerType = event.pointerType;
  }

  const reference: ElementProps['reference'] = {
    onPointerDown: setPointerRef,
    onPointerEnter: setPointerRef,
    onMouseMove(event: MouseEvent) {
      const trigger = event.currentTarget as HTMLElement;

      // `true` when there are multiple triggers per floating element and user hovers over the one that
      // wasn't used to open the floating element.
      const isOverInactiveTrigger =
        store.select('domReferenceElement') &&
        !contains(store.select('domReferenceElement'), event.target as Element);

      function handleMouseMove() {
        if (!blockMouseMove && (!store.select('open') || isOverInactiveTrigger)) {
          store.setOpen(true, createChangeEventDetails(REASONS.triggerHover, event, trigger));
        }
      }

      if ((store.select('open') && !isOverInactiveTrigger) || getRestMs(restMsOption()) === 0) {
        return;
      }

      // Ignore insignificant movements to account for tremors.
      if (
        !isOverInactiveTrigger &&
        restTimeoutPending &&
        event.movementX ** 2 + event.movementY ** 2 < 2
      ) {
        return;
      }

      restTimeout.clear();

      if (pointerType === 'touch') {
        handleMouseMove();
      } else if (isOverInactiveTrigger) {
        handleMouseMove();
      } else {
        restTimeoutPending = true;
        restTimeout.start(getRestMs(restMsOption()), handleMouseMove);
      }
    },
  };

  return { reference };
}
