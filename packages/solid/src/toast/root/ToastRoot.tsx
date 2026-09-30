import { createEffect, createMemo, createSignal, flush, omit, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { addEventListener } from '@base-ui/utils/addEventListener';
import { ownerDocument } from '@base-ui/utils/owner';
import { activeElement, contains, getTarget } from '../../floating-ui-react/utils';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import type { ToastObject as ToastObjectType } from '../useToastManager';
import { ToastRootContext } from './ToastRootContext';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { useToastProviderContext } from '../provider/ToastProviderContext';
import { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { useRenderElement } from '../../internals/useRenderElement';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import {
  BASE_UI_SWIPE_IGNORE_SELECTOR,
  LEGACY_SWIPE_IGNORE_SELECTOR,
} from '../../internals/constants';
import { getDisplacement } from '../../utils/useSwipeDismiss';
import { getElementTransform } from '../../utils/getElementTransform';
import { createRef } from '../../solid-utils/refs';
import { IsolateChildren } from '../../solid-utils/isolateChildren';
import * as ToastRootCssVars from './ToastRootCssVars';
import * as ToastRootDataAttributes from './ToastRootDataAttributes';

export const toastRootStateAttributesMapping: StateAttributesMapping<ToastRootState> = {
  ...transitionStatusMapping,
  swipeDirection(value) {
    return value ? { [ToastRootDataAttributes.swipeDirection]: value } : null;
  },
};

const SWIPE_THRESHOLD = 40;
const REVERSE_CANCEL_THRESHOLD = 10;
const OPPOSITE_DIRECTION_DAMPING_FACTOR = 0.5;
const MIN_DRAG_THRESHOLD = 1;
const TOAST_SWIPE_IGNORE_SELECTOR = `${BASE_UI_SWIPE_IGNORE_SELECTOR},${LEGACY_SWIPE_IGNORE_SELECTOR}`;

/**
 * Groups all parts of an individual toast.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastRoot(componentProps: ToastRoot.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'toast',
    'render',
    'className',
    'class',
    'swipeDirection',
    'style',
    'ref',
  );

  const isAnchored = () => componentProps.toast.positionerProps?.anchor !== undefined;

  const swipeDirections = createMemo<('up' | 'down' | 'left' | 'right')[]>(() => {
    if (isAnchored()) {
      return [];
    }
    const swipeDirection = componentProps.swipeDirection ?? ['down', 'right'];
    return Array.isArray(swipeDirection) ? swipeDirection : [swipeDirection];
  });

  const swipeEnabled = () => swipeDirections().length > 0;

  const store = useToastProviderContext();

  const [currentSwipeDirection, setCurrentSwipeDirection] = createSignal<
    'up' | 'down' | 'left' | 'right' | undefined
  >(undefined, { ownedWrite: true });
  const [isSwiping, setIsSwiping] = createSignal(false, { ownedWrite: true });
  const [isRealSwipe, setIsRealSwipe] = createSignal(false, { ownedWrite: true });
  const [dragOffset, setDragOffset] = createSignal({ x: 0, y: 0 }, { ownedWrite: true });
  const [initialTransform, setInitialTransform] = createSignal(
    { x: 0, y: 0, scale: 1 },
    { ownedWrite: true },
  );
  const [titleId, setTitleId] = createSignal<string | undefined>(undefined, { ownedWrite: true });
  const [descriptionId, setDescriptionId] = createSignal<string | undefined>(undefined, {
    ownedWrite: true,
  });
  const [lockedDirection, setLockedDirection] = createSignal<'horizontal' | 'vertical' | null>(
    null,
    { ownedWrite: true },
  );

  const rootRef = createRef<HTMLDivElement>();
  let lastToastId: string | undefined;
  let dragStartPos = { x: 0, y: 0 };
  let initialTransformValue = { x: 0, y: 0, scale: 1 };
  let intendedSwipeDirection: 'up' | 'down' | 'left' | 'right' | undefined;
  let maxSwipeDisplacement = 0;
  let cancelledSwipe = false;
  let swipeCancelBaseline = { x: 0, y: 0 };
  let isFirstPointerMove = false;
  let dragOffsetValue = { x: 0, y: 0 };
  let activePointerId: number | null = null;
  let dragAbortController: AbortController | null = null;

  const domIndex = store.useState('toastIndex', () => componentProps.toast.id);
  const visibleIndex = store.useState('toastVisibleIndex', () => componentProps.toast.id);
  const offsetY = store.useState('toastOffsetY', () => componentProps.toast.id);
  const focused = store.useState('focused');
  const expanded = store.useState('expanded');

  useOpenChangeComplete({
    get open() {
      return componentProps.toast.transitionStatus !== 'ending';
    },
    ref: rootRef,
    onComplete() {
      if (untrack(() => componentProps.toast.transitionStatus) === 'ending') {
        store.removeToast(untrack(() => componentProps.toast.id));
      }
    },
  });

  // Recalculates the natural height of the toast and updates it in the toast manager.
  // `flushSync` applies the reactive update synchronously, avoiding visual
  // flickers when called from observer callbacks.
  // The store ignores this write while the toast is transitioning out.
  const recalculateHeight = (flushSync: boolean = false) => {
    const element = rootRef.current;
    if (!element) {
      return;
    }

    const previousHeight = element.style.height;
    element.style.height = 'auto';

    const height = element.offsetHeight;

    element.style.height = previousHeight;

    store.updateToastInternal(untrack(() => componentProps.toast.id), {
      ref: rootRef,
      height,
      transitionStatus: undefined,
    });

    if (flushSync) {
      flush();
    }
  };

  // Initialize the toast on mount, and reinitialize when it begins a new lifecycle:
  // re-adding an ending toast retains the same root instance (keyed by toast id), and
  // index-keyed lists can hand an existing instance a different toast.
  // Solid note: this is a `createEffect` rather than a render effect because it
  // needs the rendered element (via `rootRef`) to measure its height.
  createEffect(
    () => ({
      id: componentProps.toast.id,
      transitionStatus: componentProps.toast.transitionStatus,
    }),
    (current) => {
      const previousToastId = lastToastId;
      // `recalculateHeight` clears the `starting` status itself, so bail out on the
      // resulting re-run and on the later `ending` one, which the store discards anyway.
      if (current.transitionStatus !== 'starting' && previousToastId === current.id) {
        return;
      }

      if (previousToastId !== undefined) {
        // A retained root keeps component-local swipe state from its previous lifecycle;
        // clear it so the toast doesn't stay offset or exit in the swiped direction.
        setCurrentSwipeDirection(undefined);
        setInitialTransform({ x: 0, y: 0, scale: 1 });
        setResolvedDragOffset({ x: 0, y: 0 });
      }

      lastToastId = current.id;
      recalculateHeight();
    },
  );

  function setResolvedDragOffset(nextDragOffset: { x: number; y: number }) {
    dragOffsetValue = nextDragOffset;
    setDragOffset(nextDragOffset);
  }

  onCleanup(() => {
    dragAbortController?.abort();
  });

  function applyDirectionalDamping(deltaX: number, deltaY: number) {
    const directions = untrack(swipeDirections);
    const damp = (delta: number) =>
      delta > 0
        ? delta ** OPPOSITE_DIRECTION_DAMPING_FACTOR
        : -(Math.abs(delta) ** OPPOSITE_DIRECTION_DAMPING_FACTOR);

    const dampX =
      (deltaX > 0 && !directions.includes('right')) ||
      (deltaX < 0 && !directions.includes('left'));
    const dampY =
      (deltaY > 0 && !directions.includes('down')) || (deltaY < 0 && !directions.includes('up'));

    return {
      x: dampX ? damp(deltaX) : deltaX,
      y: dampY ? damp(deltaY) : deltaY,
    };
  }

  const handleSwipeEnd = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) {
      return;
    }

    activePointerId = null;
    dragAbortController?.abort();
    dragAbortController = null;
    setIsSwiping(false);
    setIsRealSwipe(false);
    setLockedDirection(null);

    const resolvedInitialTransform = initialTransformValue;

    if (event.type === 'pointercancel' || cancelledSwipe) {
      setResolvedDragOffset({ x: resolvedInitialTransform.x, y: resolvedInitialTransform.y });
      setCurrentSwipeDirection(undefined);
      return;
    }

    const resolvedDragOffset = dragOffsetValue;
    const deltaX = resolvedDragOffset.x - resolvedInitialTransform.x;
    const deltaY = resolvedDragOffset.y - resolvedInitialTransform.y;
    let dismissDirection: 'up' | 'down' | 'left' | 'right' | undefined;

    for (const direction of untrack(swipeDirections)) {
      if (getDisplacement(direction, deltaX, deltaY) > SWIPE_THRESHOLD) {
        dismissDirection = direction;
        break;
      }
    }

    if (dismissDirection) {
      setCurrentSwipeDirection(dismissDirection);
      store.closeToast(untrack(() => componentProps.toast.id));
    } else {
      setResolvedDragOffset({ x: resolvedInitialTransform.x, y: resolvedInitialTransform.y });
      setCurrentSwipeDirection(undefined);
    }
  };

  function handlePointerDown(event: PointerEvent) {
    if (event.button !== 0) {
      return;
    }

    if (event.pointerType === 'touch') {
      store.pauseTimers();
    }

    const target = getTarget(event) as HTMLElement | null;

    const isInteractiveElement = target?.closest(
      `button,a,input,textarea,[role="button"],${TOAST_SWIPE_IGNORE_SELECTOR}`,
    );

    if (isInteractiveElement) {
      return;
    }

    cancelledSwipe = false;
    intendedSwipeDirection = undefined;
    maxSwipeDisplacement = 0;
    activePointerId = event.pointerId;
    dragStartPos = { x: event.clientX, y: event.clientY };
    swipeCancelBaseline = dragStartPos;

    const element = event.currentTarget as HTMLElement;

    const transform = getElementTransform(element);
    initialTransformValue = transform;
    setInitialTransform(transform);
    setResolvedDragOffset({
      x: transform.x,
      y: transform.y,
    });

    store.set('hovering', true);
    setIsSwiping(true);
    setIsRealSwipe(false);
    setLockedDirection(null);
    isFirstPointerMove = true;

    dragAbortController?.abort();
    const abortController = new AbortController();
    dragAbortController = abortController;

    const doc = ownerDocument(element);
    doc.addEventListener('pointerup', handleSwipeEnd, { signal: abortController.signal });
    doc.addEventListener('pointercancel', handleSwipeEnd, { signal: abortController.signal });

    element.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent) {
    if (event.pointerId !== activePointerId) {
      return;
    }

    // Prevent text selection on Safari
    event.preventDefault();

    if (isFirstPointerMove) {
      // Adjust the starting position to the current position on the first move
      // to account for the delay between pointerdown and the first pointermove on iOS.
      dragStartPos = { x: event.clientX, y: event.clientY };
      isFirstPointerMove = false;
    }

    const { clientY, clientX, movementX, movementY } = event;

    if (
      (movementY < 0 && clientY > swipeCancelBaseline.y) ||
      (movementY > 0 && clientY < swipeCancelBaseline.y)
    ) {
      swipeCancelBaseline = { x: swipeCancelBaseline.x, y: clientY };
    }

    if (
      (movementX < 0 && clientX > swipeCancelBaseline.x) ||
      (movementX > 0 && clientX < swipeCancelBaseline.x)
    ) {
      swipeCancelBaseline = { x: clientX, y: swipeCancelBaseline.y };
    }

    const deltaX = clientX - dragStartPos.x;
    const deltaY = clientY - dragStartPos.y;
    const cancelDeltaY = clientY - swipeCancelBaseline.y;
    const cancelDeltaX = clientX - swipeCancelBaseline.x;

    const directions = untrack(swipeDirections);
    let resolvedLockedDirection = untrack(lockedDirection);

    if (!untrack(isRealSwipe)) {
      const movementDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      if (movementDistance >= MIN_DRAG_THRESHOLD) {
        setIsRealSwipe(true);
        // `lockedDirection` is always reset alongside `isRealSwipe`, so it is
        // still `null` here. Locking is only meaningful when both axes are
        // swipeable; otherwise the single axis already constrains the gesture.
        const hasHorizontal = directions.includes('left') || directions.includes('right');
        const hasVertical = directions.includes('up') || directions.includes('down');
        if (hasHorizontal && hasVertical) {
          const absX = Math.abs(deltaX);
          const absY = Math.abs(deltaY);
          resolvedLockedDirection = absX > absY ? 'horizontal' : 'vertical';
          setLockedDirection(resolvedLockedDirection);
        }
      }
    }

    let candidate: 'up' | 'down' | 'left' | 'right' | undefined;
    if (!intendedSwipeDirection) {
      if (resolvedLockedDirection === 'vertical') {
        if (deltaY > 0) {
          candidate = 'down';
        } else if (deltaY < 0) {
          candidate = 'up';
        }
      } else if (resolvedLockedDirection === 'horizontal') {
        if (deltaX > 0) {
          candidate = 'right';
        } else if (deltaX < 0) {
          candidate = 'left';
        }
      } else if (Math.abs(deltaX) >= Math.abs(deltaY)) {
        candidate = deltaX > 0 ? 'right' : 'left';
      } else {
        candidate = deltaY > 0 ? 'down' : 'up';
      }

      if (candidate && directions.includes(candidate)) {
        intendedSwipeDirection = candidate;
        maxSwipeDisplacement = getDisplacement(candidate, deltaX, deltaY);
        setCurrentSwipeDirection(candidate);
      }
    } else {
      const direction = intendedSwipeDirection;
      const currentDisplacement = getDisplacement(direction, cancelDeltaX, cancelDeltaY);

      if (currentDisplacement > SWIPE_THRESHOLD) {
        cancelledSwipe = false;
        setCurrentSwipeDirection(direction);
      } else if (
        !(directions.includes('left') && directions.includes('right')) &&
        !(directions.includes('up') && directions.includes('down')) &&
        maxSwipeDisplacement - currentDisplacement >= REVERSE_CANCEL_THRESHOLD
      ) {
        // Mark that a change-of-mind has occurred
        cancelledSwipe = true;
      }
    }

    const dampedDelta = applyDirectionalDamping(deltaX, deltaY);
    let newOffsetX = initialTransformValue.x;
    let newOffsetY = initialTransformValue.y;

    const hasHorizontalDir = directions.includes('left') || directions.includes('right');
    const hasVerticalDir = directions.includes('up') || directions.includes('down');

    if (resolvedLockedDirection !== 'vertical' && hasHorizontalDir) {
      newOffsetX += dampedDelta.x;
    }

    if (resolvedLockedDirection !== 'horizontal' && hasVerticalDir) {
      newOffsetY += dampedDelta.y;
    }

    setResolvedDragOffset({ x: newOffsetX, y: newOffsetY });
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (
        !rootRef.current ||
        !contains(rootRef.current, activeElement(ownerDocument(rootRef.current)))
      ) {
        return;
      }

      store.closeToast(untrack(() => componentProps.toast.id));
    }
  }

  createEffect(
    () => swipeEnabled(),
    (enabled) => {
      const element = rootRef.current;
      if (!enabled || !element) {
        return undefined;
      }

      function preventDefaultTouchStart(event: TouchEvent) {
        if (activePointerId === null || !contains(element, getTarget(event) as HTMLElement | null)) {
          return;
        }

        // A pointermove preventDefault is not enough on iOS; this
        // non-passive touchmove listener blocks native scrolling while dragging.
        event.preventDefault();
      }

      return addEventListener(element, 'touchmove', preventDefaultTouchStart, { passive: false });
    },
  );

  function getDragStyles(): JSX.CSSProperties {
    const resolvedDragOffset = dragOffset();
    const resolvedInitialTransform = initialTransform();
    const swiping = isSwiping();
    const deltaX = resolvedDragOffset.x - resolvedInitialTransform.x;
    const deltaY = resolvedDragOffset.y - resolvedInitialTransform.y;

    return {
      transition: swiping ? 'none' : undefined,
      // While swiping, freeze the element at its current visual transform so it doesn't snap to the
      // end position.
      transform: swiping
        ? `translateX(${resolvedDragOffset.x}px) translateY(${resolvedDragOffset.y}px) scale(${resolvedInitialTransform.scale})`
        : undefined,
      [ToastRootCssVars.swipeMovementX]: `${deltaX}px`,
      [ToastRootCssVars.swipeMovementY]: `${deltaY}px`,
    };
  }

  const isHighPriority = () => componentProps.toast.priority === 'high';

  const defaultProps: HTMLProps = {
    get role() {
      return isHighPriority() ? 'alertdialog' : 'dialog';
    },
    tabindex: 0,
    'aria-modal': 'false',
    get 'aria-labelledby'() {
      return titleId();
    },
    get 'aria-describedby'() {
      return descriptionId();
    },
    get 'aria-hidden'() {
      return isHighPriority() && !focused() ? 'true' : undefined;
    },
    onPointerDown(event: PointerEvent) {
      if (untrack(swipeEnabled)) {
        handlePointerDown(event);
      }
    },
    onPointerMove(event: PointerEvent) {
      if (untrack(swipeEnabled)) {
        handlePointerMove(event);
      }
    },
    onPointerUp(event: PointerEvent) {
      if (untrack(swipeEnabled)) {
        handleSwipeEnd(event);
      }
    },
    onPointerCancel(event: PointerEvent) {
      if (untrack(swipeEnabled)) {
        handleSwipeEnd(event);
      }
    },
    onKeyDown: handleKeyDown,
    get inert() {
      return componentProps.toast.limited ?? false;
    },
    get style(): JSX.CSSProperties {
      return {
        ...getDragStyles(),
        [ToastRootCssVars.index]: String(
          componentProps.toast.transitionStatus === 'ending' ? domIndex() : visibleIndex(),
        ),
        [ToastRootCssVars.offsetY]: `${offsetY()}px`,
        [ToastRootCssVars.height]: componentProps.toast.height
          ? `${componentProps.toast.height}px`
          : undefined,
      };
    },
  };

  const toastRoot: ToastRootContext = {
    get toast() {
      return componentProps.toast;
    },
    setTitleId,
    setDescriptionId,
    recalculateHeight,
    get visibleIndex() {
      return visibleIndex();
    },
    get expanded() {
      return expanded();
    },
  };

  const state: ToastRootState = {
    get transitionStatus() {
      return componentProps.toast.transitionStatus;
    },
    get expanded() {
      return expanded();
    },
    get limited() {
      return componentProps.toast.limited || false;
    },
    get type() {
      return componentProps.toast.type;
    },
    get swiping() {
      return isSwiping();
    },
    get swipeDirection() {
      return currentSwipeDirection();
    },
  };

  // `useRenderElement` is invoked inside the JSX children position so the
  // user's children are created under the context provider.
  return (
    <ToastRootContext value={toastRoot}>
      <IsolateChildren>
        {useRenderElement('div', componentProps, {
          ref: [componentProps.ref, rootRef],
          state,
          stateAttributesMapping: toastRootStateAttributesMapping,
          props: [defaultProps, elementProps],
        })}
      </IsolateChildren>
    </ToastRootContext>
  );
}

export type ToastRootToastObject<Data extends object = any> = ToastObjectType<Data>;

export interface ToastRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * Whether the toasts in the viewport are expanded.
   */
  expanded: boolean;
  /**
   * Whether the toast was limited because the toast limit was exceeded.
   */
  limited: boolean;
  /**
   * The type of the toast.
   */
  type: string | undefined;
  /**
   * Whether the toast is being swiped.
   */
  swiping: boolean;
  /**
   * The direction the toast is being swiped.
   */
  swipeDirection: 'up' | 'down' | 'left' | 'right' | undefined;
}

export interface ToastRootProps extends BaseUIComponentProps<'div', ToastRootState> {
  /**
   * The toast to render.
   */
  toast: ToastRootToastObject<any>;
  /**
   * Direction(s) in which the toast can be swiped to dismiss.
   * @default ['down', 'right']
   */
  swipeDirection?:
    'up' | 'down' | 'left' | 'right' | ('up' | 'down' | 'left' | 'right')[] | undefined;
}

export namespace ToastRoot {
  export type ToastObject<Data extends object = any> = ToastRootToastObject<Data>;
  export type State = ToastRootState;
  export type Props = ToastRootProps;
}
