import { createEffect, createMemo, createRenderEffect, createSignal, flush, omit, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { isElement } from '@floating-ui/utils/dom';
import { addEventListener } from '@base-ui/utils/addEventListener';
import { ownerDocument, ownerWindow } from '@base-ui/utils/owner';
import { clamp } from '@base-ui/utils/clamp';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import { DialogViewport } from '../../dialog/viewport/DialogViewport';
import * as DialogViewportDataAttributes from '../../dialog/viewport/DialogViewportDataAttributes';
import { mergeProps } from '../../merge-props';
import { useDrawerRootContext } from '../root/DrawerRootContext';
import {
  closestSnapPointIndex,
  getSnapPointSwipeMovement,
  useDrawerSnapPoints,
  type ResolvedDrawerSnapPoint,
} from '../root/useDrawerSnapPoints';
import { useDrawerProviderContext } from '../provider/DrawerProviderContext';
import {
  getDisplacement,
  useSwipeDismiss,
  type SwipeDirection,
  type UseSwipeDismissProgressDetails,
} from '../../utils/useSwipeDismiss';
import * as DrawerPopupCssVars from '../popup/DrawerPopupCssVars';
import * as DrawerPopupDataAttributes from '../popup/DrawerPopupDataAttributes';
import * as DrawerBackdropCssVars from '../backdrop/DrawerBackdropCssVars';
import { DRAWER_CONTENT_ATTRIBUTE } from '../content/drawerContentAttribute';
import { REASONS } from '../../internals/reasons';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { activeElement, contains, getTarget } from '../../floating-ui-react/utils/element';
import { DrawerViewportContext } from './DrawerViewportContext';
import { TransitionStatusDataAttributes } from '../../internals/stateAttributesMapping';
import { findScrollableTouchTarget, type ScrollAxis } from '../../utils/scrollable';
import { BASE_UI_SWIPE_IGNORE_SELECTOR } from '../../internals/constants';
import { getElementAtPoint } from '../../utils/getElementAtPoint';
import type { BaseUIComponentProps, StyleValue } from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { useAnimationFrame } from '../../solid-utils/timers';
import { useDrawerVirtualKeyboardContext } from '../virtual-keyboard-provider/DrawerVirtualKeyboardContext';

const MIN_SWIPE_THRESHOLD = 10;
const FAST_SWIPE_VELOCITY = 0.5;
const SNAP_VELOCITY_THRESHOLD = 0.5;
const SNAP_VELOCITY_MULTIPLIER = 300;
const MAX_SNAP_VELOCITY = 4;
const MIN_SWIPE_RELEASE_VELOCITY = 0.2;
const MAX_SWIPE_RELEASE_VELOCITY = 4;
const MIN_SWIPE_RELEASE_DURATION_MS = 80;
const MAX_SWIPE_RELEASE_DURATION_MS = 360;
const MIN_SWIPE_RELEASE_SCALAR = 0.1;
const MAX_SWIPE_RELEASE_SCALAR = 1;
const AXIS_LOCK_SLOP = 6;
const AXIS_LOCK_BIAS = 2;
const DRAWER_CONTENT_SELECTOR = `[${DRAWER_CONTENT_ATTRIBUTE}]`;

interface TouchScrollState {
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  scrollTarget: HTMLElement | null;
  hasCrossAxisScrollableContent: boolean;
  allowSwipe: boolean | null;
  preserveNativeCrossAxisScroll: boolean;
  drawerAxisAttributed: boolean;
}

/**
 * A positioning container for the drawer popup that can be made scrollable.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Drawer](https://base-ui.com/react/components/drawer)
 */
export function DrawerViewport(props: DrawerViewport.Props): JSX.Element {
  const elementProps = omit(props, 'render', 'className', 'class', 'style', 'ref', 'children');

  const store = useDialogRootContext();
  const popupRef = store.context.popupRef;
  const backdropRef = store.context.backdropRef;

  const drawerRootContext = useDrawerRootContext();
  const {
    swipeDirection,
    notifyParentSwipingChange,
    notifyParentSwipeProgressChange,
    frontmostHeight,
    snapToSequentialPoints,
    swipeAreaActiveRef,
  } = drawerRootContext;
  const providerContext = useDrawerProviderContext();
  const {
    snapPoints,
    resolvedSnapPoints,
    activeSnapPoint,
    activeSnapPointOffset,
    setActiveSnapPoint,
    popupHeight,
  } = useDrawerSnapPoints();

  const open = store.useState('open');
  const mounted = store.useState('mounted');
  const nested = store.useState('nested');
  const nestedOpenDrawerCount = store.useState('nestedOpenDrawerCount');
  const viewportElement = store.useState('viewportElement');
  const popupElementState = store.useState('popupElement');

  const visualStateStore = providerContext?.visualStateStore;
  const nestedDrawerOpen = () => nestedOpenDrawerCount() > 0;
  const scrollAxis = (): ScrollAxis =>
    swipeDirection() === 'left' || swipeDirection() === 'right' ? 'horizontal' : 'vertical';
  const isVerticalScrollAxis = () => scrollAxis() === 'vertical';
  const crossScrollAxis = (): ScrollAxis => (isVerticalScrollAxis() ? 'horizontal' : 'vertical');

  const [swipeRelease, setSwipeRelease] = createSignal<number | null>(null, { ownedWrite: true });

  let pendingSwipeCloseSnapPoint: ReturnType<typeof activeSnapPoint> | undefined;
  const controlledDismissFrame = useAnimationFrame();

  let swipingCurrent = false;
  let nestedSwipeActive = false;
  let lastPointerType: string = '';
  let ignoreNextTouchStartFromPen = false;
  let ignoreTouchSwipe = false;
  let touchScrollState: TouchScrollState | null = null;

  const virtualKeyboard = useDrawerVirtualKeyboardContext();

  const snapPointRange = createMemo(() => {
    const points = snapPoints();
    const resolved = resolvedSnapPoints();
    const direction = swipeDirection();
    if (
      !points ||
      points.length < 2 ||
      resolved.length < 2 ||
      (direction !== 'down' && direction !== 'up')
    ) {
      return null;
    }

    const offsets = resolved.map((point) => point.offset).sort((a, b) => a - b);

    const minOffset = offsets[0];
    const nextOffset = offsets[1];
    const range = nextOffset - minOffset;

    return { minOffset, range };
  });

  const snapPointProgress = createMemo(() => {
    const range = snapPointRange();
    const offset = activeSnapPointOffset();
    if (!range || offset === null) {
      return null;
    }

    return clamp((offset - range.minOffset) / range.range, 0, 1);
  });

  const swipeDirections = createMemo<SwipeDirection[]>(() => {
    const points = snapPoints();
    const direction = swipeDirection();
    if (points && points.length > 0 && (direction === 'down' || direction === 'up')) {
      return direction === 'down' ? ['down', 'up'] : ['up', 'down'];
    }

    return [direction];
  });

  const setSwipeDismissed = (dismissed: boolean) => {
    popupRef.current?.toggleAttribute(DrawerPopupDataAttributes.swipeDismiss, dismissed);
    backdropRef.current?.toggleAttribute(DrawerPopupDataAttributes.swipeDismiss, dismissed);
  };

  const clearSwipeRelease = () => {
    setSwipeDismissed(false);
    popupRef.current?.removeAttribute(TransitionStatusDataAttributes.endingStyle);
    setSwipeRelease(null);
  };

  const finishNestedSwipe = () => {
    if (!nestedSwipeActive) {
      return;
    }

    nestedSwipeActive = false;
    notifyParentSwipingChange?.(false);
  };

  const applySwipeProgress = (
    resolvedProgress: number,
    shouldTrackProgress: boolean,
    notifyParent: boolean,
  ) => {
    const currentOpen = store.select('open');
    const currentNested = store.select('nested');
    const currentFrontmostHeight = untrack(frontmostHeight);
    const isActive = currentOpen && !currentNested && shouldTrackProgress;
    const swipeProgress = isActive ? resolvedProgress : 0;
    const nestedSwipeProgress = currentOpen && shouldTrackProgress ? resolvedProgress : 0;

    if (notifyParent && notifyParentSwipeProgressChange) {
      notifyParentSwipeProgressChange(nestedSwipeProgress);

      if (nestedSwipeProgress <= 0) {
        finishNestedSwipe();
      }
    }

    visualStateStore?.set({
      swipeProgress,
      frontmostHeight: swipeProgress > 0 ? currentFrontmostHeight : 0,
    });

    const backdropElement = backdropRef.current;
    if (!backdropElement) {
      return;
    }

    const showProgress = isActive && swipeProgress > 0;
    backdropElement.style.setProperty(
      DrawerBackdropCssVars.swipeProgress,
      showProgress ? `${swipeProgress}` : '0',
    );
    if (showProgress && currentFrontmostHeight > 0) {
      backdropElement.style.setProperty(DrawerPopupCssVars.height, `${currentFrontmostHeight}px`);
    } else {
      backdropElement.style.removeProperty(DrawerPopupCssVars.height);
    }
  };

  function resolveSwipeRelease(
    popupElement: HTMLElement,
    direction: SwipeDirection,
    deltaX: number,
    deltaY: number,
    velocityX: number,
    velocityY: number,
    releaseVelocityX: number,
    releaseVelocityY: number,
  ): number | null {
    const size = getBaseSwipeSize(popupElement, direction);
    if (size <= 0) {
      return null;
    }

    // The snap point base offset shifts the popup along the dismiss direction for both
    // `down` (+offset) and `up` (-offset), so it always adds to the directional translation.
    const points = untrack(snapPoints);
    const snapPointBaseOffset =
      (direction === 'down' || direction === 'up') && points && points.length > 0
        ? (untrack(activeSnapPointOffset) ?? 0)
        : 0;
    const translationAlongDirection =
      snapPointBaseOffset + getDisplacement(direction, deltaX, deltaY);
    const remainingDistance = Math.max(0, size - translationAlongDirection);
    if (remainingDistance <= 0) {
      return null;
    }

    const releaseVelocity = getDisplacement(direction, releaseVelocityX, releaseVelocityY);
    const directionalVelocity =
      Math.abs(releaseVelocity) > 0
        ? releaseVelocity
        : getDisplacement(direction, velocityX, velocityY);
    if (directionalVelocity <= MIN_SWIPE_RELEASE_VELOCITY) {
      return null;
    }

    const clampedVelocity = clamp(
      directionalVelocity,
      MIN_SWIPE_RELEASE_VELOCITY,
      MAX_SWIPE_RELEASE_VELOCITY,
    );
    // The gesture hook supplies finite deltas and velocities. The guards above keep the remaining
    // distance and divisor positive, so the duration stays within [MIN, MAX] and the resulting
    // scalar within (0, 1].
    const durationMs = clamp(
      remainingDistance / clampedVelocity,
      MIN_SWIPE_RELEASE_DURATION_MS,
      MAX_SWIPE_RELEASE_DURATION_MS,
    );
    const normalizedDuration =
      (durationMs - MIN_SWIPE_RELEASE_DURATION_MS) /
      (MAX_SWIPE_RELEASE_DURATION_MS - MIN_SWIPE_RELEASE_DURATION_MS);
    return (
      MIN_SWIPE_RELEASE_SCALAR +
      normalizedDuration * (MAX_SWIPE_RELEASE_SCALAR - MIN_SWIPE_RELEASE_SCALAR)
    );
  }

  function updateNestedSwipeActive(details?: UseSwipeDismissProgressDetails) {
    if (nestedSwipeActive || !details) {
      return;
    }

    const direction = details.direction ?? untrack(swipeDirection);
    const delta = getDisplacement(direction, details.deltaX, details.deltaY);
    if (Math.abs(delta) < MIN_SWIPE_THRESHOLD) {
      return;
    }

    nestedSwipeActive = true;
    notifyParentSwipingChange?.(true);
  }

  const swipe = useSwipeDismiss({
    get enabled() {
      return mounted() && !nestedDrawerOpen();
    },
    get directions() {
      return swipeDirections();
    },
    elementRef: store.context.popupRef,
    ignoreSelectorWhenTouch: false,
    ignoreScrollableAncestors: true,
    movementCssVars: {
      x: DrawerPopupCssVars.swipeMovementX,
      y: DrawerPopupCssVars.swipeMovementY,
    },
    onSwipeStart(event) {
      if ('touches' in event || event.pointerType === 'touch') {
        return;
      }

      const popupElement = popupRef.current;

      const doc = ownerDocument(popupElement);
      const selection = doc.getSelection?.();
      if (!selection || selection.isCollapsed) {
        return;
      }

      const anchorElement = isElement(selection.anchorNode)
        ? selection.anchorNode
        : selection.anchorNode?.parentElement;
      const focusElement = isElement(selection.focusNode)
        ? selection.focusNode
        : selection.focusNode?.parentElement;

      if (!contains(popupElement, anchorElement) && !contains(popupElement, focusElement)) {
        return;
      }

      selection.removeAllRanges();
    },
    onSwipingChange(swiping) {
      swipingCurrent = swiping;
      setBackdropSwipingAttribute(store.context.backdropRef.current, swiping);

      if (!swiping && !notifyParentSwipeProgressChange) {
        finishNestedSwipe();
      }
    },
    swipeThreshold({ element, direction }) {
      return getBaseSwipeThreshold(element, direction);
    },
    canStart(position, details) {
      const popupElement = store.context.popupRef.current;
      if (!popupElement) {
        return false;
      }

      const doc = popupElement.ownerDocument;
      const elementAtPoint = getElementAtPoint(popupElement.getRootNode(), position.x, position.y);
      if (!elementAtPoint || !contains(popupElement, elementAtPoint)) {
        return false;
      }

      const nativeEvent = details.nativeEvent;
      const touchLike = 'touches' in nativeEvent || nativeEvent.pointerType === 'touch';
      if (touchLike && shouldIgnoreSwipeForTextSelection(doc, popupElement)) {
        return false;
      }

      return true;
    },
    onProgress(progress, details) {
      const swiping = swipingCurrent;

      if (swiping) {
        updateNestedSwipeActive(details);
      }

      const points = untrack(snapPoints);
      const currentSwipeDirection = untrack(swipeDirection);
      const hasSnapPoints = Boolean(points && points.length > 0);
      if (swiping && currentSwipeDirection === 'down' && hasSnapPoints && details) {
        const popupElement = store.context.popupRef.current;
        if (popupElement) {
          popupElement.style.removeProperty('transform');
          popupElement.style.setProperty(
            DrawerPopupCssVars.swipeMovementY,
            `${getSnapPointSwipeMovement(untrack(activeSnapPointOffset) ?? 0, details.deltaY)}px`,
          );
        }
      }

      let resolvedProgress = progress;
      const range = untrack(snapPointRange);
      const currentPopupHeight = untrack(popupHeight);
      if (range && currentPopupHeight > 0) {
        const baseOffset = untrack(activeSnapPointOffset) ?? range.minOffset;
        const offsetToProgress = (nextOffset: number) =>
          clamp((nextOffset - range.minOffset) / range.range, 0, 1);

        // Outside a drag the hook still reports the last drag deltas, both after a release and
        // on a gesture that never started (e.g. a press inside `Drawer.Content`). Recomputing
        // from them would re-apply drag progress to a drawer that rests on its snap point.
        if (swiping && details && Number.isFinite(details.deltaY)) {
          resolvedProgress = offsetToProgress(
            clamp(baseOffset + details.deltaY, 0, currentPopupHeight),
          );
        } else if (untrack(snapPointProgress) !== null) {
          resolvedProgress = untrack(snapPointProgress)!;
        }
      }

      // A parent drawer follows an active drag only, so drop it back to zero once the drag ends.
      if (!swiping) {
        notifyParentSwipeProgressChange?.(0);
        finishNestedSwipe();
      }

      applySwipeProgress(resolvedProgress, true, swiping);
    },
    onRelease({
      event,
      deltaX,
      deltaY,
      direction,
      velocityX,
      velocityY,
      releaseVelocityX,
      releaseVelocityY,
    }) {
      const popupElement = store.context.popupRef.current;
      if (!popupElement) {
        clearSwipeRelease();
        return undefined;
      }
      const releasePopupElement = popupElement;

      function startSwipeRelease(resolvedDirection: SwipeDirection) {
        // Start ending transition styles earlier and synchronously to prevent a period where
        // the popup appears stuck on release before the actual closing animation starts.
        finishNestedSwipe();
        setSwipeDismissed(true);

        releasePopupElement.style.removeProperty('transition');
        releasePopupElement.setAttribute(TransitionStatusDataAttributes.endingStyle, '');
        setSwipeRelease(
          resolveSwipeRelease(
            releasePopupElement,
            resolvedDirection,
            deltaX,
            deltaY,
            velocityX,
            velocityY,
            releaseVelocityX,
            releaseVelocityY,
          ),
        );
        // The Solid equivalent of React's `flushSync` around the state write.
        flush();
      }

      const points = untrack(snapPoints);
      const currentSwipeDirection = untrack(swipeDirection);
      const currentPopupHeight = untrack(popupHeight);
      const resolved = untrack(resolvedSnapPoints);

      if (!points || points.length === 0) {
        if (!direction) {
          clearSwipeRelease();
          return undefined;
        }

        const directionalDelta = getDisplacement(direction, deltaX, deltaY);
        if (directionalDelta <= 0) {
          clearSwipeRelease();
          return false;
        }

        if (getDisplacement(direction, velocityX, velocityY) >= FAST_SWIPE_VELOCITY) {
          startSwipeRelease(direction);
          return true;
        }

        const shouldClose =
          directionalDelta > getBaseSwipeThreshold(releasePopupElement, direction);
        if (shouldClose) {
          startSwipeRelease(direction);
        } else {
          clearSwipeRelease();
        }
        return shouldClose;
      }

      if (currentSwipeDirection !== 'down' && currentSwipeDirection !== 'up') {
        clearSwipeRelease();
        return undefined;
      }

      if (!currentPopupHeight) {
        clearSwipeRelease();
        return false;
      }

      if (resolved.length === 0) {
        clearSwipeRelease();
        return undefined;
      }

      const dragDelta = currentSwipeDirection === 'down' ? deltaY : -deltaY;
      const dragDirection = Math.sign(dragDelta);
      const releaseDirectionalVelocity =
        currentSwipeDirection === 'down' ? releaseVelocityY : -releaseVelocityY;
      const fallbackDirectionalVelocity =
        currentSwipeDirection === 'down' ? velocityY : -velocityY;
      let resolvedDirectionalVelocity = releaseDirectionalVelocity;
      if (dragDirection !== 0 && Math.abs(dragDelta) >= MIN_SWIPE_THRESHOLD) {
        const velocityDirection = Math.sign(resolvedDirectionalVelocity);
        if (velocityDirection !== 0 && velocityDirection !== dragDirection) {
          // Ignore touch reversals that would otherwise flip the snap decision.
          resolvedDirectionalVelocity = fallbackDirectionalVelocity;
        }
      }

      const currentOffset = untrack(activeSnapPointOffset) ?? 0;
      const dragTargetOffset = clamp(currentOffset + dragDelta, 0, currentPopupHeight);
      const velocityOffset =
        Math.abs(resolvedDirectionalVelocity) >= SNAP_VELOCITY_THRESHOLD
          ? clamp(resolvedDirectionalVelocity, -MAX_SNAP_VELOCITY, MAX_SNAP_VELOCITY) *
            SNAP_VELOCITY_MULTIPLIER
          : 0;
      const targetOffset = untrack(snapToSequentialPoints)
        ? dragTargetOffset
        : clamp(dragTargetOffset + velocityOffset, 0, currentPopupHeight);
      const snapPointEventDetails = createChangeEventDetails(REASONS.swipe, event);

      const settleInPlace = () => {
        // Reset nested swipe state now: the hook's trailing progress update is deduped
        // when the drag never produced dismissal progress, so it may not fire.
        applySwipeProgress(0, true, true);
        clearSwipeRelease();
        return false;
      };

      const settleOnSnapPoint = (snapPoint: ResolvedDrawerSnapPoint) => {
        setActiveSnapPoint(snapPoint.value, snapPointEventDetails);
        return settleInPlace();
      };

      const closeFromSnapPoints = (fallbackSnapPoint: ResolvedDrawerSnapPoint) => {
        // An unattributed gesture (e.g. a mostly horizontal flick) may settle on a snap
        // point but must not dismiss: `useSwipeDismiss` drops a directionless dismissal,
        // stranding the popup visually closed while `open` stays `true`.
        if (!direction) {
          return settleOnSnapPoint(fallbackSnapPoint);
        }
        setActiveSnapPoint(null, snapPointEventDetails);
        if (snapPointEventDetails.isCanceled) {
          // A canceled null snap point rejects dismissal before exit styles start.
          return settleInPlace();
        }
        pendingSwipeCloseSnapPoint = untrack(activeSnapPoint);
        startSwipeRelease(currentSwipeDirection);
        return true;
      };

      if (untrack(snapToSequentialPoints)) {
        const orderedSnapPoints = [...resolved].sort(
          (first, second) => first.offset - second.offset,
        );
        const orderedOffsets = orderedSnapPoints.map((point) => point.offset);
        const currentIndex = closestSnapPointIndex(orderedOffsets, currentOffset);
        let targetSnapPoint =
          orderedSnapPoints[closestSnapPointIndex(orderedOffsets, targetOffset)];

        const velocityDirection = Math.sign(resolvedDirectionalVelocity);
        const shouldAdvance =
          dragDirection !== 0 &&
          velocityDirection !== 0 &&
          velocityDirection === dragDirection &&
          Math.abs(resolvedDirectionalVelocity) >= SNAP_VELOCITY_THRESHOLD;
        let effectiveTargetOffset = targetOffset;

        if (shouldAdvance) {
          const adjacentIndex = clamp(
            currentIndex + dragDirection,
            0,
            orderedSnapPoints.length - 1,
          );
          if (adjacentIndex !== currentIndex) {
            const adjacentPoint = orderedSnapPoints[adjacentIndex];
            const shouldForceAdjacent =
              dragDirection > 0
                ? targetOffset < adjacentPoint.offset
                : targetOffset > adjacentPoint.offset;
            if (shouldForceAdjacent) {
              targetSnapPoint = adjacentPoint;
              effectiveTargetOffset = adjacentPoint.offset;
            }
          } else if (dragDirection > 0) {
            return closeFromSnapPoints(targetSnapPoint);
          }
        }

        const closeDistance = Math.abs(effectiveTargetOffset - currentPopupHeight);
        const snapDistance = Math.abs(effectiveTargetOffset - targetSnapPoint.offset);
        if (closeDistance < snapDistance) {
          return closeFromSnapPoints(targetSnapPoint);
        }

        return settleOnSnapPoint(targetSnapPoint);
      }

      const closestSnapPoint =
        resolved[
          closestSnapPointIndex(
            resolved.map((point) => point.offset),
            targetOffset,
          )
        ];

      if (resolvedDirectionalVelocity >= FAST_SWIPE_VELOCITY && dragDelta > 0) {
        return closeFromSnapPoints(closestSnapPoint);
      }

      const closeDistance = Math.abs(targetOffset - currentPopupHeight);
      if (closeDistance < Math.abs(targetOffset - closestSnapPoint.offset)) {
        return closeFromSnapPoints(closestSnapPoint);
      }

      return settleOnSnapPoint(closestSnapPoint);
    },
    onDismiss(event) {
      visualStateStore?.set({ swipeProgress: 0, frontmostHeight: 0 });

      const backdropElement = store.context.backdropRef.current;
      if (backdropElement) {
        backdropElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, '0');
        backdropElement.style.removeProperty(DrawerPopupCssVars.height);
      }

      const dismissEventDetails: Parameters<typeof store.setOpen>[1] = createChangeEventDetails(
        REASONS.swipe,
        event,
      );
      store.setOpen(false, dismissEventDetails);

      if (dismissEventDetails.isCanceled) {
        if (pendingSwipeCloseSnapPoint !== undefined) {
          setActiveSnapPoint(
            pendingSwipeCloseSnapPoint,
            createChangeEventDetails(REASONS.swipe, event),
          );
        }

        pendingSwipeCloseSnapPoint = undefined;
        resetSwipe();
        clearSwipeRelease();
        return;
      }

      // In controlled mode, the effective open state may not have changed yet
      // (openProp takes precedence over state.open). Proceed optimistically with the
      // dismiss animation and re-check on the next frame whether the parent accepted
      // or rejected the close.
      // Note: if onOpenChange is asynchronous (e.g., closes the drawer after a network
      // call), the rAF check will see open === true, revert the animation, and the
      // drawer will close without animation when the parent eventually sets open={false}.
      if (store.select('open')) {
        const savedEvent = event;
        controlledDismissFrame.request(() => {
          if (store.select('open')) {
            // Parent rejected: revert animation and restore snap point.
            if (pendingSwipeCloseSnapPoint !== undefined) {
              setActiveSnapPoint(
                pendingSwipeCloseSnapPoint,
                createChangeEventDetails(REASONS.swipe, savedEvent),
              );
            }
            pendingSwipeCloseSnapPoint = undefined;
            clearSwipeRelease();
            resetSwipe();
          } else {
            // Parent accepted: clean up the pending state.
            pendingSwipeCloseSnapPoint = undefined;
          }
        });
        return;
      }

      pendingSwipeCloseSnapPoint = undefined;
      setSwipeDismissed(true);
    },
  });

  const swipePointerProps = swipe.getPointerProps();
  const swipeTouchProps = swipe.getTouchProps();
  const { moveNative: moveSwipeNative, reset: resetSwipe } = swipe;

  createEffect(
    () => ({
      rootElement: viewportElement() ?? popupElementState(),
      open: open(),
      mounted: mounted(),
      nestedDrawerOpen: nestedDrawerOpen(),
      isVerticalScrollAxis: isVerticalScrollAxis(),
      scrollAxis: scrollAxis(),
      swipeDirection: swipeDirection(),
    }),
    (current) => {
      const rootElement = current.rootElement;
      if (!rootElement) {
        return undefined;
      }

      const resolvedRootElement: HTMLElement = rootElement;

      const doc = ownerDocument(resolvedRootElement);
      function processTouchMove(event: TouchEvent, touchState: TouchScrollState, touch: Touch) {
        const drawerAxisDelta = current.isVerticalScrollAxis
          ? touch.clientY - touchState.lastY
          : touch.clientX - touchState.lastX;

        // Avoid blocking pinch zoom or text selection adjustments on iOS Safari.
        if (event.touches.length === 2) {
          return;
        }

        const allowTouchMove = shouldIgnoreSwipeForTextSelection(doc, resolvedRootElement);

        if (allowTouchMove || !current.open || !current.mounted || current.nestedDrawerOpen) {
          return;
        }

        if (shouldYieldTouchMove(touchState, event, touch, current.isVerticalScrollAxis)) {
          return;
        }

        const scrollTarget = touchState.scrollTarget;
        if (!scrollTarget || scrollTarget === doc.documentElement || scrollTarget === doc.body) {
          if (event.cancelable) {
            event.preventDefault();
          }
          // Claim the gesture before delegated touch handlers see it.
          event.stopPropagation();
          moveSwipeNative(event, resolvedRootElement);
          return;
        }

        if (!hasScrollableContentOnAxis(scrollTarget, current.scrollAxis)) {
          // If the scroll container doesn't overflow on the drawer axis, prevent the window from
          // scrolling instead.
          if (event.cancelable) {
            event.preventDefault();
          }
          event.stopPropagation();
          return;
        }

        if (drawerAxisDelta !== 0) {
          const canSwipeFromScrollEdge = canSwipeFromScrollEdgeOnMove(
            scrollTarget,
            current.scrollAxis,
            current.swipeDirection,
            drawerAxisDelta,
          );

          if (!touchState.allowSwipe) {
            if (event.cancelable && canSwipeFromScrollEdge) {
              touchState.allowSwipe = true;
              event.preventDefault();
            } else {
              touchState.allowSwipe = false;
            }
          } else if (event.cancelable) {
            event.preventDefault();
          }
        }

        if (touchState.allowSwipe === true) {
          event.stopPropagation();
          moveSwipeNative(event, resolvedRootElement);
        }
      }

      function handleNativeTouchMove(event: TouchEvent) {
        // The virtual keyboard provider observes the move to tell a tap apart from a drag.
        // It must run even when the swipe gesture below claims the event with
        // `stopPropagation()`, which would otherwise prevent delegated handlers
        // (and the provider) from ever seeing the move.
        virtualKeyboard?.onTouchMove(event);

        if (ignoreTouchSwipe) {
          return;
        }

        const touchState = touchScrollState;
        const touch = event.touches[0];
        if (!touch || !touchState) {
          return;
        }

        processTouchMove(event, touchState, touch);
        updateTouchScrollPosition(touchState, touch);
      }

      return addEventListener(doc, 'touchmove', handleNativeTouchMove, {
        passive: false,
        capture: true,
      });
    },
  );

  createRenderEffect(
    () => ({
      snapPointRange: snapPointRange(),
      swiping: swipe.swiping(),
      open: open(),
      nested: nested(),
      snapPointProgress: snapPointProgress(),
      frontmostHeight: frontmostHeight(),
    }),
    (current) => {
      if (!current.snapPointRange || current.swiping) {
        return;
      }

      applySwipeProgress(
        !current.open || current.nested ? 0 : (current.snapPointProgress ?? 0),
        true,
        false,
      );
    },
  );

  createRenderEffect(
    () => open(),
    (isOpen) => {
      if (!notifyParentSwipeProgressChange) {
        return undefined;
      }

      if (!isOpen) {
        notifyParentSwipeProgressChange(0);
      }

      return () => {
        notifyParentSwipeProgressChange(0);
      };
    },
  );

  createRenderEffect(
    () => open(),
    (isOpen) => {
      if (isOpen) {
        // Skip `resetSwipe` while `Drawer.SwipeArea` is driving the open: it zeroes the popup's
        // `--swipe-movement-*` (via `syncDragStyles(false)`), flashing it fully open for a frame.
        // `clearSwipeRelease` doesn't touch those vars, so always run it to clear any leftover
        // release state from a prior dismiss (e.g. when the popup is kept mounted).
        if (!swipeAreaActiveRef.current) {
          resetSwipe();
        }
        clearSwipeRelease();
      }
    },
  );

  onCleanup(() => {
    visualStateStore?.set({ swipeProgress: 0, frontmostHeight: 0 });
    setBackdropSwipingAttribute(backdropRef.current, false);
    finishNestedSwipe();
  });

  const swipeProviderValue = {
    swiping: swipe.swiping,
    getDragStyles: swipe.getDragStyles,
    swipeStrength: swipeRelease,
    setSwipeDismissed,
  };

  function resetTouchSwipeState(ignoreSwipe: boolean) {
    ignoreTouchSwipe = ignoreSwipe;
    touchScrollState = null;
  }

  function resetTouchTrackingState() {
    resetTouchSwipeState(false);
    lastPointerType = '';
    ignoreNextTouchStartFromPen = false;
  }

  function handlePointerEnd(event: PointerEvent): boolean {
    lastPointerType = '';
    return event.pointerType !== 'touch';
  }

  const mergedProps = mergeProps(elementProps as any, {
    onPointerDown(event: PointerEvent) {
      lastPointerType = event.pointerType;
      ignoreNextTouchStartFromPen = event.pointerType === 'pen';

      if (!store.select('open') || !store.select('mounted') || untrack(nestedDrawerOpen)) {
        return;
      }

      const elementAtPoint = getElementAtPoint(
        (event.currentTarget as HTMLElement).getRootNode(),
        event.clientX,
        event.clientY,
      );
      if (isSwipeIgnoredTarget(elementAtPoint) || isDrawerContentTarget(elementAtPoint)) {
        return;
      }

      if (event.pointerType === 'touch') {
        return;
      }

      swipePointerProps.onPointerDown?.(event);
    },
    onPointerMove(event: PointerEvent) {
      if (event.pointerType === 'touch') {
        return;
      }

      swipePointerProps.onPointerMove?.(event);
    },
    onPointerUp(event: PointerEvent) {
      if (handlePointerEnd(event)) {
        swipePointerProps.onPointerUp?.(event);
      }
    },
    onPointerCancel(event: PointerEvent) {
      if (handlePointerEnd(event)) {
        swipePointerProps.onPointerCancel?.(event);
      }
    },
    onTouchStart(event: TouchEvent) {
      const startedFromPenPointerDown = lastPointerType === 'pen' && ignoreNextTouchStartFromPen;
      if (startedFromPenPointerDown) {
        ignoreNextTouchStartFromPen = false;
        resetTouchSwipeState(false);
        return;
      }

      if (!store.select('open') || !store.select('mounted') || untrack(nestedDrawerOpen)) {
        resetTouchSwipeState(false);
        return;
      }

      const touch = event.touches[0];
      if (!touch) {
        return;
      }

      if (isEventOnRangeInput(event, ownerWindow(event.currentTarget as HTMLElement))) {
        resetTouchSwipeState(false);
        return;
      }

      const rootElement = event.currentTarget as HTMLElement;
      const elementAtPoint = getElementAtPoint(
        rootElement.getRootNode(),
        touch.clientX,
        touch.clientY,
      );
      const eventTarget = getTarget(event);
      const target = isElement(eventTarget) ? (eventTarget as HTMLElement) : rootElement;
      if (!contains(rootElement, target)) {
        resetTouchSwipeState(true);
        return;
      }

      virtualKeyboard?.onTouchStart(event);

      if (isSwipeIgnoredTarget(elementAtPoint)) {
        resetTouchSwipeState(true);
        return;
      }
      ignoreTouchSwipe = false;

      const scrollTarget = findScrollableTouchTarget(target, rootElement, untrack(scrollAxis));
      const hasCrossAxisScrollableContent =
        findScrollableTouchTarget(target, rootElement, untrack(crossScrollAxis)) != null;

      let allowSwipe: boolean | null = null;
      if (scrollTarget) {
        const canSwipeFromEdge = isAtSwipeStartEdge(
          scrollTarget,
          untrack(scrollAxis),
          untrack(swipeDirection),
        );

        allowSwipe = canSwipeFromEdge ? null : false;
      }

      touchScrollState = {
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastY: touch.clientY,
        scrollTarget,
        hasCrossAxisScrollableContent,
        allowSwipe,
        preserveNativeCrossAxisScroll: false,
        drawerAxisAttributed: false,
      };

      swipeTouchProps.onTouchStart?.(event);
    },
    onTouchEnd(event: TouchEvent) {
      virtualKeyboard?.onTouchEnd(event);
      resetTouchTrackingState();
      swipeTouchProps.onTouchEnd?.(event);
    },
    onTouchCancel(event: TouchEvent) {
      virtualKeyboard?.onTouchCancel();
      resetTouchTrackingState();
      swipeTouchProps.onTouchCancel?.(event);
    },
    // Drawer popups use drawer-specific nested state attributes.
    // Suppress DialogViewport's generic nested dialog attribute.
    [DialogViewportDataAttributes.nestedDialogOpen as string]: undefined,
  });

  // Forwarded through a spread rather than individual JSX attributes: Solid's
  // JSX widens attribute values with a removal sentinel that the underlying
  // Dialog prop types (state-callback forms) do not accept.
  const passthroughProps = {
    get ref() {
      return props.ref;
    },
    get className() {
      return props.className;
    },
    get class() {
      return props.class;
    },
    get style() {
      return props.style;
    },
    get render() {
      return props.render;
    },
  } as Pick<DialogViewportPassthroughProps, 'ref' | 'className' | 'class' | 'style' | 'render'>;

  return (
    <DialogViewport {...passthroughProps} {...(mergedProps as Record<string, any>)}>
      <DrawerViewportContext value={swipeProviderValue}>{props.children}</DrawerViewportContext>
    </DialogViewport>
  );
}

export interface DrawerViewportState {
  /**
   * Whether the drawer is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * Whether the drawer is nested within another drawer.
   */
  nested: boolean;
  /**
   * Whether the drawer has nested drawers open.
   */
  nestedDialogOpen: boolean;
}

export interface DrawerViewportProps extends BaseUIComponentProps<'div', DrawerViewportState> {}

type DialogViewportPassthroughProps = Parameters<typeof DialogViewport>[0];

export namespace DrawerViewport {
  export type Props = DrawerViewportProps;
  export type State = DrawerViewportState;
}

function setBackdropSwipingAttribute(backdropElement: HTMLElement | null, swiping: boolean) {
  backdropElement?.toggleAttribute(DrawerPopupDataAttributes.swiping, swiping);
}

function isSwipeIgnoredTarget(target: Element | null): boolean {
  return Boolean(target?.closest(BASE_UI_SWIPE_IGNORE_SELECTOR));
}

function isDrawerContentTarget(target: Element | null): boolean {
  return Boolean(target?.closest(DRAWER_CONTENT_SELECTOR));
}

function getBaseSwipeSize(element: HTMLElement, direction: SwipeDirection): number {
  return direction === 'left' || direction === 'right' ? element.offsetWidth : element.offsetHeight;
}

function getBaseSwipeThreshold(element: HTMLElement, direction: SwipeDirection): number {
  return Math.max(getBaseSwipeSize(element, direction) * 0.5, MIN_SWIPE_THRESHOLD);
}

function isRangeInput(
  target: EventTarget | null,
  win: ReturnType<typeof ownerWindow>,
): target is HTMLInputElement {
  return target instanceof win.HTMLInputElement && target.type === 'range';
}

function isTextSelectionControl(target: Element): target is HTMLInputElement | HTMLTextAreaElement {
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
}

function hasExpandedSelectionWithinTarget(selection: Selection, target: Element): boolean {
  const anchorElement = isElement(selection.anchorNode)
    ? selection.anchorNode
    : selection.anchorNode?.parentElement;
  const focusElement = isElement(selection.focusNode)
    ? selection.focusNode
    : selection.focusNode?.parentElement;

  return (
    selection.containsNode(target, true) ||
    contains(target, anchorElement) ||
    contains(target, focusElement)
  );
}

function shouldIgnoreSwipeForTextSelection(doc: Document, rootElement: HTMLElement): boolean {
  const activeEl = activeElement(doc);
  if (activeEl && contains(rootElement, activeEl) && isTextSelectionControl(activeEl)) {
    const { selectionStart, selectionEnd } = activeEl;
    if (selectionStart != null && selectionEnd != null && selectionStart < selectionEnd) {
      return true;
    }
  }

  const selection = doc.getSelection?.();
  if (!selection || selection.isCollapsed) {
    return false;
  }

  return hasExpandedSelectionWithinTarget(selection, rootElement);
}

function isEventOnRangeInput(event: TouchEvent, win: ReturnType<typeof ownerWindow>): boolean {
  return event.composedPath().some((pathTarget) => isRangeInput(pathTarget, win));
}

function updateTouchScrollPosition(touchState: TouchScrollState, touch: Touch): void {
  touchState.lastX = touch.clientX;
  touchState.lastY = touch.clientY;
}

/**
 * Arbitrates a touchmove between the drawer swipe and a native cross-axis scroll.
 * Returns `true` when the move must be left alone — either because the cross axis already won the
 * gesture, or because neither axis has passed the slop yet and the gesture cannot be attributed.
 */
function shouldYieldTouchMove(
  touchState: TouchScrollState,
  event: TouchEvent,
  touch: Touch,
  isVerticalScrollAxis: boolean,
): boolean {
  if (touchState.preserveNativeCrossAxisScroll) {
    return true;
  }

  // Attribution happens once per gesture. Re-arbitrating after the drawer axis has won would let
  // the pre-attribution branches below fire mid-drag (the slop is measured from the touch origin,
  // which is never re-baselined), freezing the popup and dropping `preventDefault()`.
  if (
    touchState.drawerAxisAttributed ||
    touchState.allowSwipe === true ||
    !touchState.hasCrossAxisScrollableContent
  ) {
    return false;
  }

  // A non-cancelable touchmove means the browser has already committed the gesture to a native
  // scroll; claiming it for the swipe would drag the popup alongside the scrolling content.
  if (!event.cancelable) {
    touchState.preserveNativeCrossAxisScroll = true;
    return true;
  }

  const drawerAxisGestureDelta = isVerticalScrollAxis
    ? touch.clientY - touchState.startY
    : touch.clientX - touchState.startX;
  const crossAxisGestureDelta = isVerticalScrollAxis
    ? touch.clientX - touchState.startX
    : touch.clientY - touchState.startY;
  const absDrawerAxisGestureDelta = Math.abs(drawerAxisGestureDelta);
  const absCrossAxisGestureDelta = Math.abs(crossAxisGestureDelta);

  if (
    absCrossAxisGestureDelta >= AXIS_LOCK_SLOP &&
    absCrossAxisGestureDelta > absDrawerAxisGestureDelta + AXIS_LOCK_BIAS
  ) {
    touchState.preserveNativeCrossAxisScroll = true;
    return true;
  }

  if (absDrawerAxisGestureDelta >= AXIS_LOCK_SLOP) {
    touchState.drawerAxisAttributed = true;
    return false;
  }

  // Neither axis has traveled past the slop yet, so the gesture cannot be attributed. Leave the
  // event alone: on iOS, `preventDefault()` on the first cancelable touchmove cancels native
  // scrolling for the entire gesture, which would lock a cross-axis scroll that only passes the
  // slop on a later move.
  return true;
}

function hasScrollableContentOnAxis(scrollTarget: HTMLElement, axis: ScrollAxis): boolean {
  return getScrollMetrics(scrollTarget, axis).max > 0;
}

function getScrollMetrics(scrollTarget: HTMLElement, axis: ScrollAxis) {
  if (axis === 'vertical') {
    const max = Math.max(0, scrollTarget.scrollHeight - scrollTarget.clientHeight);
    return { offset: scrollTarget.scrollTop, max };
  }

  const max = Math.max(0, scrollTarget.scrollWidth - scrollTarget.clientWidth);
  return { offset: scrollTarget.scrollLeft, max };
}

function isAtSwipeStartEdge(
  scrollTarget: HTMLElement,
  axis: ScrollAxis,
  direction: SwipeDirection,
): boolean {
  const dismissFromStartEdge = shouldDismissFromStartEdge(direction, axis);
  const { offset, max } = getScrollMetrics(scrollTarget, axis);
  return dismissFromStartEdge ? offset <= 0 : offset >= max;
}

function canSwipeFromScrollEdgeOnMove(
  scrollTarget: HTMLElement,
  axis: ScrollAxis,
  direction: SwipeDirection,
  delta: number,
): boolean {
  const dismissFromStartEdge = shouldDismissFromStartEdge(direction, axis);
  const movingTowardDismiss = dismissFromStartEdge ? delta > 0 : delta < 0;
  if (!movingTowardDismiss) {
    return false;
  }

  return isAtSwipeStartEdge(scrollTarget, axis, direction);
}

function shouldDismissFromStartEdge(direction: SwipeDirection, axis: ScrollAxis): boolean {
  return axis === 'vertical' ? direction === 'down' : direction === 'right';
}
