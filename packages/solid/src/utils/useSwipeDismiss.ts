import { createSignal, untrack, type Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { ownerDocument } from '@base-ui/utils/owner';
import { clamp } from '@base-ui/utils/clamp';
import { contains, getTarget } from '../floating-ui-react/utils/element';
import { findScrollableTouchTarget, hasScrollableAncestor, type ScrollAxis } from './scrollable';
import { getElementAtPoint } from './getElementAtPoint';
import { getElementTransform } from './getElementTransform';
import type { RefObject } from '../solid-utils/refs';

export type SwipeDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Synthetic move event fed through `moveNative` by consumers that claim the
 * gesture in a capture-phase listener.
 */
interface SwipeDismissNativeTouchMove {
  readonly touches: TouchList;
  readonly currentTarget: HTMLElement;
  readonly nativeEvent: TouchEvent;
  readonly defaultPrevented: boolean;
  readonly timeStamp: number;
}

type SwipeDismissNativeEvent = PointerEvent | TouchEvent;
type SwipeDismissStartEvent = PointerEvent | TouchEvent;
type SwipeDismissMoveEvent = PointerEvent | TouchEvent | SwipeDismissNativeTouchMove;
type SwipeDismissEndEvent = PointerEvent | TouchEvent;
type SwipeProgressDetailsInternal = {
  deltaX: number;
  deltaY: number;
  direction: SwipeDirection | undefined;
};

const DEFAULT_SWIPE_THRESHOLD = 40;
const REVERSE_CANCEL_THRESHOLD = 10;
const MIN_DRAG_THRESHOLD = 1;
const MIN_VELOCITY_DURATION_MS = 50;
const MIN_RELEASE_VELOCITY_DURATION_MS = 16;
const MAX_RELEASE_VELOCITY_AGE_MS = 80;
const DEFAULT_IGNORE_SELECTOR = 'button,a,input,select,textarea,label,[role="button"]';

export function getDisplacement(direction: SwipeDirection, deltaX: number, deltaY: number) {
  switch (direction) {
    case 'up':
      return -deltaY;
    case 'down':
      return deltaY;
    case 'left':
      return -deltaX;
    case 'right':
      return deltaX;
    default:
      return 0;
  }
}

function getValidTimeStamp(timeStamp: number): number | null {
  return Number.isFinite(timeStamp) && timeStamp > 0 ? timeStamp : null;
}

function getDragTransform(dragOffset: { x: number; y: number }, scale: number): string {
  return `translate3d(${dragOffset.x}px,${dragOffset.y}px,0) scale(${scale})`;
}

function hasPrimaryMouseButton(buttons: number): boolean {
  return buttons % 2 === 1;
}

function toNativeEvent(
  event: SwipeDismissStartEvent | SwipeDismissMoveEvent | SwipeDismissEndEvent,
): SwipeDismissNativeEvent {
  return 'nativeEvent' in event ? event.nativeEvent : (event as SwipeDismissNativeEvent);
}

function safelyChangePointerCapture(
  element: HTMLElement,
  pointerId: number,
  method: 'setPointerCapture' | 'releasePointerCapture',
) {
  const pointerCaptureMethod = element[method];
  if (typeof pointerCaptureMethod !== 'function') {
    return;
  }

  try {
    pointerCaptureMethod.call(element, pointerId);
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'NotFoundError') {
      return;
    }
    throw error;
  }
}

/**
 * Solid port of `useSwipeDismiss`. `options` is a reactive object (use getters
 * for reactive fields); `swiping`, `swipeDirection` and `dragDismissed` come
 * back as accessors.
 */
export function useSwipeDismiss(options: UseSwipeDismissOptions): UseSwipeDismissReturnValue {
  const enabled = () => options.enabled;
  const directions = () => options.directions;
  const elementRef = options.elementRef;
  const movementCssVars = options.movementCssVars;
  const ignoreSelectorWhenTouch = () => options.ignoreSelectorWhenTouch ?? true;
  const ignoreScrollableAncestors = () => options.ignoreScrollableAncestors ?? false;
  const trackDrag = () => options.trackDrag ?? true;

  const ignoreSelector = DEFAULT_IGNORE_SELECTOR;
  const primaryDirection = () => {
    const value = directions();
    return value.length === 1 ? value[0] : undefined;
  };

  const swipeThresholdDefault = () =>
    Math.max(
      0,
      typeof options.swipeThreshold === 'number' ? options.swipeThreshold : DEFAULT_SWIPE_THRESHOLD,
    );

  const allowLeft = () => directions().includes('left');
  const allowRight = () => directions().includes('right');
  const allowUp = () => directions().includes('up');
  const allowDown = () => directions().includes('down');
  const hasHorizontal = () => allowLeft() || allowRight();
  const hasVertical = () => allowUp() || allowDown();

  const scrollAxes = (): ScrollAxis[] => {
    const axes: ScrollAxis[] = [];
    if (hasVertical()) {
      axes.push('vertical');
    }
    if (hasHorizontal()) {
      axes.push('horizontal');
    }
    return axes;
  };

  const [currentSwipeDirection, setCurrentSwipeDirection] = createSignal<
    SwipeDirection | undefined
  >(undefined, { ownedWrite: true });
  const [isSwiping, setIsSwiping] = createSignal(false, { ownedWrite: true });
  const [dragDismissed, setDragDismissed] = createSignal(false, { ownedWrite: true });

  let dragStartPos = { x: 0, y: 0 };
  let dragOffset = { x: 0, y: 0 };
  let lastMovePos: { x: number; y: number } | null = null;
  let initialTransform = { x: 0, y: 0, scale: 1 };
  let intendedSwipeDirection: SwipeDirection | undefined;
  let maxSwipeDisplacement = 0;
  let cancelledSwipe = false;
  let swipeCancelBaseline = { x: 0, y: 0 };
  let lockedDirectionState: 'horizontal' | 'vertical' | null = null;
  let isFirstPointerMove = false;
  let pendingSwipe = false;
  let pendingSwipeStartPos: { x: number; y: number } | null = null;
  let swipeFromScrollable = false;
  let sawPrimaryButtonsOnMove = false;
  let elementSize = { width: 0, height: 0 };
  let swipeProgressCurrent = 0;
  let swipeThreshold = untrack(swipeThresholdDefault);
  let swipeThresholdFunction:
    | ((details: { element: HTMLElement; direction: SwipeDirection }) => number)
    | null = null;
  let swipeStartTime: number | null = null;
  let lastDragSample: { x: number; y: number; time: number } | null = null;
  let lastDragVelocity = { x: 0, y: 0 };
  let lastProgressDetails: SwipeProgressDetailsInternal | null = null;
  let isSwipingCurrent = false;
  let dragStyleSnapshot: [string, string] | null = null;

  const setSwiping = (nextSwiping: boolean) => {
    if (isSwipingCurrent === nextSwiping) {
      return;
    }

    isSwipingCurrent = nextSwiping;
    setIsSwiping(nextSwiping);
    options.onSwipingChange?.(nextSwiping);
  };

  function resolveSwipeThreshold(direction: SwipeDirection | undefined) {
    if (!direction) {
      return;
    }

    const element = elementRef.current;
    const thresholdFunction = swipeThresholdFunction;
    if (!element || !thresholdFunction) {
      return;
    }

    const value = thresholdFunction({ element, direction });

    swipeThreshold = Math.max(0, value);
  }

  const updateSwipeProgress = (progress: number, details?: SwipeProgressDetailsInternal) => {
    const nextProgress = Number.isFinite(progress) ? clamp(progress, 0, 1) : 0;
    const progressChanged = nextProgress !== swipeProgressCurrent;
    let detailsChanged = false;

    if (details) {
      const lastDetails = lastProgressDetails;

      detailsChanged =
        !lastDetails ||
        lastDetails.deltaX !== details.deltaX ||
        lastDetails.deltaY !== details.deltaY ||
        lastDetails.direction !== details.direction;
    }

    if (!progressChanged && !detailsChanged) {
      return;
    }

    swipeProgressCurrent = nextProgress;
    if (details) {
      lastProgressDetails = details;
    } else if (progressChanged) {
      lastProgressDetails = null;
    }
    options.onProgress?.(nextProgress, details);
  };

  const syncDragStyles = (swiping: boolean) => {
    const element = elementRef.current;
    if (!untrack(trackDrag) || !element) {
      if (!swiping) {
        dragStyleSnapshot = null;
      }
      return;
    }

    const style = element.style;
    if (swiping) {
      if (!dragStyleSnapshot) {
        dragStyleSnapshot = [style.transition, style.transform];
      }

      style.transition = 'none';
    } else if (dragStyleSnapshot) {
      [style.transition, style.transform] = dragStyleSnapshot;
      dragStyleSnapshot = null;
    }

    const deltaX = dragOffset.x - initialTransform.x;
    const deltaY = dragOffset.y - initialTransform.y;

    if (swiping) {
      style.transform = getDragTransform(dragOffset, initialTransform.scale);
    }

    style.setProperty(movementCssVars.x, `${deltaX}px`);
    style.setProperty(movementCssVars.y, `${deltaY}px`);
  };

  function recordDragSample(offset: { x: number; y: number }, timeStamp: number | null) {
    if (timeStamp === null) {
      return;
    }

    if (lastDragSample && timeStamp > lastDragSample.time) {
      const durationMs = Math.max(
        timeStamp - lastDragSample.time,
        MIN_RELEASE_VELOCITY_DURATION_MS,
      );

      lastDragVelocity = {
        x: (offset.x - lastDragSample.x) / durationMs,
        y: (offset.y - lastDragSample.y) / durationMs,
      };
    }

    lastDragSample = { x: offset.x, y: offset.y, time: timeStamp };
  }

  const reset = () => {
    setCurrentSwipeDirection(undefined);
    setSwiping(false);
    setDragDismissed(false);
    updateSwipeProgress(0);

    swipeThreshold = untrack(swipeThresholdDefault);
    swipeThresholdFunction = null;
    dragStartPos = { x: 0, y: 0 };
    dragOffset = { x: 0, y: 0 };
    initialTransform = { x: 0, y: 0, scale: 1 };
    intendedSwipeDirection = undefined;
    maxSwipeDisplacement = 0;
    cancelledSwipe = false;
    swipeCancelBaseline = { x: 0, y: 0 };
    lockedDirectionState = null;
    isFirstPointerMove = false;
    lastMovePos = null;
    pendingSwipe = false;
    pendingSwipeStartPos = null;
    swipeFromScrollable = false;
    sawPrimaryButtonsOnMove = false;
    elementSize = { width: 0, height: 0 };
    swipeStartTime = null;
    lastDragSample = null;
    lastDragVelocity = { x: 0, y: 0 };
    lastProgressDetails = null;
    syncDragStyles(false);
  };

  function getPrimaryPointerPosition(
    event: SwipeDismissStartEvent | SwipeDismissMoveEvent | SwipeDismissEndEvent,
  ) {
    if ('touches' in event) {
      const touch = event.touches[0];
      return touch ? { x: touch.clientX, y: touch.clientY } : null;
    }

    return { x: event.clientX, y: event.clientY };
  }

  function isTouchLikeEvent(
    event: SwipeDismissStartEvent | SwipeDismissMoveEvent | SwipeDismissEndEvent,
  ) {
    if ('touches' in event) {
      return true;
    }
    return event.pointerType === 'touch';
  }

  function getTargetAtPoint(position: { x: number; y: number }, nativeEvent: Event) {
    const root = elementRef.current?.getRootNode();
    const elementAtPoint = getElementAtPoint(root, position.x, position.y);
    const target = elementAtPoint ?? getTarget(nativeEvent);
    return target as HTMLElement | null;
  }

  function findGestureScrollableTouchTarget(
    target: EventTarget | null,
    root: HTMLElement,
  ): HTMLElement | null {
    // The swiped element is positioned relative to the viewport, so the page scroller must not
    // gate the gesture (a reset like `html, body { height: 100%; overflow: auto }` makes `body`
    // a real scroll container). The drawer viewport's native touchmove handler already ignores it.
    const find = (axis: ScrollAxis) => {
      const scrollTarget = findScrollableTouchTarget(target, root, axis);
      const doc = ownerDocument(scrollTarget);
      return scrollTarget === doc.body || scrollTarget === doc.documentElement
        ? null
        : scrollTarget;
    };

    if (hasHorizontal() && !hasVertical()) {
      return find('horizontal');
    }
    if (hasVertical() && !hasHorizontal()) {
      return find('vertical');
    }
    return find('vertical') ?? find('horizontal');
  }

  function startSwipeAtPosition(
    event: SwipeDismissStartEvent | SwipeDismissMoveEvent,
    position: { x: number; y: number },
    startOptions?: {
      ignoreScrollableTarget?: boolean | undefined;
      ignoreScrollableAncestors?: boolean | undefined;
    },
  ) {
    swipeFromScrollable = false;
    const touchLike = isTouchLikeEvent(event);
    const target = getTargetAtPoint(position, toNativeEvent(event));

    const doc = ownerDocument(elementRef.current);
    const body = doc.body;

    const scrollableTarget =
      touchLike && body ? findGestureScrollableTouchTarget(target, body) : null;
    const ignoreScrollableTarget = startOptions?.ignoreScrollableTarget ?? false;
    if (scrollableTarget && !ignoreScrollableTarget) {
      return false;
    }
    swipeFromScrollable = Boolean(scrollableTarget && ignoreScrollableTarget);

    const isInteractiveElement = target ? target.closest(ignoreSelector) : false;
    if (isInteractiveElement && (!touchLike || ignoreSelectorWhenTouch())) {
      return false;
    }

    const element = elementRef.current;
    if (ignoreScrollableAncestors() && element && target && scrollAxes().length > 0) {
      const ignoreAncestors = startOptions?.ignoreScrollableAncestors ?? false;
      if (!ignoreAncestors && hasScrollableAncestor(target, element, scrollAxes())) {
        return false;
      }
    }

    cancelledSwipe = false;
    intendedSwipeDirection = undefined;
    maxSwipeDisplacement = 0;

    dragStartPos = position;
    swipeStartTime = getValidTimeStamp(event.timeStamp);
    swipeCancelBaseline = position;
    lastMovePos = position;
    swipeThreshold = untrack(swipeThresholdDefault);
    swipeThresholdFunction =
      typeof options.swipeThreshold === 'function' ? options.swipeThreshold : null;

    if (element) {
      elementSize = { width: element.offsetWidth, height: element.offsetHeight };
      resolveSwipeThreshold(primaryDirection());
      const transform = getElementTransform(element);

      initialTransform = transform;
      dragOffset = { x: transform.x, y: transform.y };
      recordDragSample({ x: transform.x, y: transform.y }, swipeStartTime);

      if (!('touches' in event)) {
        safelyChangePointerCapture(element, event.pointerId, 'setPointerCapture');
      }
    }

    options.onSwipeStart?.(toNativeEvent(event));

    setSwiping(true);
    lockedDirectionState = null;
    isFirstPointerMove = true;
    updateSwipeProgress(0);
    syncDragStyles(true);

    return true;
  }

  function resetPendingSwipeState() {
    clearPendingSwipeStartState();
    swipeFromScrollable = false;
    lastMovePos = null;
  }

  function clearPendingSwipeStartState() {
    pendingSwipe = false;
    pendingSwipeStartPos = null;
  }

  function cancelSwipeInteraction(event: PointerEvent) {
    resetPendingSwipeState();

    if (!isSwipingCurrent) {
      return;
    }

    setSwiping(false);
    lockedDirectionState = null;

    dragOffset = { x: initialTransform.x, y: initialTransform.y };
    setCurrentSwipeDirection(undefined);
    sawPrimaryButtonsOnMove = false;
    syncDragStyles(false);

    const element = elementRef.current;
    if (element) {
      safelyChangePointerCapture(element, event.pointerId, 'releasePointerCapture');
    }

    updateSwipeProgress(0, {
      deltaX: 0,
      deltaY: 0,
      direction: undefined,
    });

    options.onCancel?.(event);
  }

  function applyDirectionalDamping(deltaX: number, deltaY: number) {
    const exponent = (value: number) => Math.sign(value) * Math.abs(value) ** 0.5;
    const dampAxis = (delta: number, allowNegative: boolean, allowPositive: boolean) => {
      if ((!allowNegative && delta < 0) || (!allowPositive && delta > 0)) {
        return exponent(delta);
      }
      return delta;
    };

    const newDeltaX = hasHorizontal()
      ? dampAxis(deltaX, allowLeft(), allowRight())
      : exponent(deltaX);
    const newDeltaY = hasVertical() ? dampAxis(deltaY, allowUp(), allowDown()) : exponent(deltaY);

    return { x: newDeltaX, y: newDeltaY };
  }

  function canSwipeFromScrollEdgeOnPendingMove(
    scrollTarget: HTMLElement,
    deltaX: number,
    deltaY: number,
  ): boolean | null {
    // Swiping toward the axis start edge (down/right) is allowed when scrolled to the start;
    // toward the end edge (up/left) when scrolled to the end.
    const canSwipeOnAxis = (
      delta: number,
      scrollOffset: number,
      maxScrollOffset: number,
      allowTowardStart: boolean,
      allowTowardEnd: boolean,
    ) =>
      (delta > 0 && scrollOffset <= 0 && allowTowardStart) ||
      (delta < 0 && scrollOffset >= Math.max(0, maxScrollOffset) && allowTowardEnd);

    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    if (hasVertical() && deltaY !== 0 && (!hasHorizontal() || absDeltaY >= absDeltaX)) {
      return canSwipeOnAxis(
        deltaY,
        scrollTarget.scrollTop,
        scrollTarget.scrollHeight - scrollTarget.clientHeight,
        allowDown(),
        allowUp(),
      );
    }

    if (hasHorizontal() && deltaX !== 0 && (!hasVertical() || absDeltaX > absDeltaY)) {
      return canSwipeOnAxis(
        deltaX,
        scrollTarget.scrollLeft,
        scrollTarget.scrollWidth - scrollTarget.clientWidth,
        allowRight(),
        allowLeft(),
      );
    }

    return null;
  }

  const handleStart = (event: SwipeDismissStartEvent) => {
    if (!untrack(enabled)) {
      return;
    }

    if (event.defaultPrevented) {
      return;
    }

    if (!('touches' in event) && event.button !== 0) {
      return;
    }

    const startPos = getPrimaryPointerPosition(event);
    if (!startPos) {
      return;
    }

    pendingSwipe = true;
    pendingSwipeStartPos = startPos;
    swipeFromScrollable = false;
    sawPrimaryButtonsOnMove = !('touches' in event);

    const allowedToStart = options.canStart
      ? options.canStart(startPos, {
          nativeEvent: toNativeEvent(event),
          direction: primaryDirection(),
        })
      : true;
    if (!allowedToStart) {
      return;
    }

    if (startSwipeAtPosition(event, startPos)) {
      clearPendingSwipeStartState();
    }
  };

  function handleMoveCore(
    event: SwipeDismissMoveEvent,
    position: { x: number; y: number },
    movement: { x: number; y: number },
  ) {
    if (!untrack(enabled) || !isSwipingCurrent) {
      return;
    }

    const target = getTarget(toNativeEvent(event)) as HTMLElement | null;
    if (isTouchLikeEvent(event) && !swipeFromScrollable) {
      const boundaryElement = event.currentTarget as HTMLElement;
      if (findGestureScrollableTouchTarget(target, boundaryElement)) {
        return;
      }
    }

    if (!('touches' in event)) {
      // Prevent text selection on Safari
      event.preventDefault();
    }

    if (isFirstPointerMove) {
      isFirstPointerMove = false;
      // Reset the drag origin to the first move's position to absorb the gap between the press and
      // the first move event — notably on iOS touch, where the first `touchmove` arrives already
      // offset from the `touchstart` — which would otherwise make the dragged element jump. This
      // only matters when an element follows the pointer; when `trackDrag` is false (e.g. the
      // swipe-area, which only opens the drawer) keep the original press position so a quick flick
      // still registers: on a low-refresh-rate display the whole travel can land in this single
      // first move, and discarding it would drop the gesture.
      if (untrack(trackDrag)) {
        dragStartPos = position;
        const moveTime = getValidTimeStamp(event.timeStamp);
        if (moveTime !== null) {
          swipeStartTime = moveTime;
        }
      }
    }

    const clientX = position.x;
    const clientY = position.y;
    const movementX = movement.x;
    const movementY = movement.y;

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

    let lockedDirection = lockedDirectionState;
    if (lockedDirection === null && hasHorizontal() && hasVertical()) {
      const movementDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      if (movementDistance >= MIN_DRAG_THRESHOLD) {
        lockedDirection = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
        lockedDirectionState = lockedDirection;
      }
    }

    let candidate: SwipeDirection | undefined;
    if (!intendedSwipeDirection) {
      if (lockedDirection === 'vertical') {
        if (deltaY > 0) {
          candidate = 'down';
        } else if (deltaY < 0) {
          candidate = 'up';
        }
      } else if (lockedDirection === 'horizontal') {
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

      if (candidate) {
        const isAllowed =
          (candidate === 'left' && allowLeft()) ||
          (candidate === 'right' && allowRight()) ||
          (candidate === 'up' && allowUp()) ||
          (candidate === 'down' && allowDown());
        if (isAllowed) {
          intendedSwipeDirection = candidate;
          maxSwipeDisplacement = getDisplacement(candidate, deltaX, deltaY);
          setCurrentSwipeDirection(candidate);
          resolveSwipeThreshold(candidate);
        }
      }
    } else {
      const direction = intendedSwipeDirection;
      const currentDisplacement = getDisplacement(direction, cancelDeltaX, cancelDeltaY);
      if (currentDisplacement > swipeThreshold) {
        cancelledSwipe = false;
        setCurrentSwipeDirection(direction);
      } else if (
        !(allowLeft() && allowRight()) &&
        !(allowUp() && allowDown()) &&
        maxSwipeDisplacement - currentDisplacement >= REVERSE_CANCEL_THRESHOLD
      ) {
        // Mark that a change-of-mind has occurred
        cancelledSwipe = true;
      }
    }

    const dampedDelta = applyDirectionalDamping(deltaX, deltaY);
    let newOffsetX = initialTransform.x;
    let newOffsetY = initialTransform.y;

    if (lockedDirection === 'horizontal') {
      if (hasHorizontal()) {
        newOffsetX += dampedDelta.x;
      }
    } else if (lockedDirection === 'vertical') {
      if (hasVertical()) {
        newOffsetY += dampedDelta.y;
      }
    } else {
      if (hasHorizontal()) {
        newOffsetX += dampedDelta.x;
      }
      if (hasVertical()) {
        newOffsetY += dampedDelta.y;
      }
    }

    // Only rewrite drag styles when the drag offset actually changed. `syncDragStyles` writes the
    // raw (undamped) frozen transform and movement vars, relying on the consumer's `onProgress`
    // to overwrite them with damped styles — but `updateSwipeProgress` dedupes unchanged
    // deltas and skips `onProgress`. A move that doesn't change the offset (e.g. the cursor
    // pinned at a screen edge during an off-screen drag, jittering only on the ignored axis)
    // would otherwise reinstate the raw styles with no correction, jumping the element to the
    // undamped position.
    const previousOffset = dragOffset;
    const offsetChanged = newOffsetX !== previousOffset.x || newOffsetY !== previousOffset.y;

    dragOffset = { x: newOffsetX, y: newOffsetY };
    if (offsetChanged) {
      syncDragStyles(true);
    }
    recordDragSample({ x: newOffsetX, y: newOffsetY }, getValidTimeStamp(event.timeStamp));
    const dragDeltaX = newOffsetX - initialTransform.x;
    const dragDeltaY = newOffsetY - initialTransform.y;
    const progressDetails: SwipeProgressDetailsInternal = {
      deltaX: dragDeltaX,
      deltaY: dragDeltaY,
      direction: intendedSwipeDirection,
    };

    let progress = 0;
    const progressDirection = primaryDirection() ?? intendedSwipeDirection;
    if (progressDirection) {
      const size =
        progressDirection === 'left' || progressDirection === 'right'
          ? elementSize.width
          : elementSize.height;
      const scale = initialTransform.scale || 1;
      const progressDisplacement = getDisplacement(progressDirection, dragDeltaX, dragDeltaY);
      if (size > 0 && scale > 0 && progressDisplacement > 0) {
        progress = progressDisplacement / (size * scale);
      }
    }

    updateSwipeProgress(progress, progressDetails);
  }

  const handleEnd = (event: SwipeDismissEndEvent) => {
    if (!untrack(enabled)) {
      return;
    }

    const resolvedDragOffset = dragOffset;
    const resolvedInitialTransform = initialTransform;
    const releaseDeltaX = resolvedDragOffset.x - resolvedInitialTransform.x;
    const releaseDeltaY = resolvedDragOffset.y - resolvedInitialTransform.y;
    const progressDetails: SwipeProgressDetailsInternal = {
      deltaX: releaseDeltaX,
      deltaY: releaseDeltaY,
      direction: intendedSwipeDirection,
    };

    if (!isSwipingCurrent) {
      resetPendingSwipeState();
      updateSwipeProgress(0, progressDetails);
      return;
    }

    setSwiping(false);
    lockedDirectionState = null;
    resetPendingSwipeState();
    sawPrimaryButtonsOnMove = false;

    const element = elementRef.current;
    if (element) {
      if (!('touches' in event)) {
        safelyChangePointerCapture(element, event.pointerId, 'releasePointerCapture');
      }
    }

    const deltaX = releaseDeltaX;
    const deltaY = releaseDeltaY;
    const startTime = swipeStartTime;
    const endTime = getValidTimeStamp(event.timeStamp);
    const durationMs =
      startTime !== null && endTime !== null && endTime > startTime ? endTime - startTime : 0;
    const velocityDurationMs = durationMs > 0 ? Math.max(durationMs, MIN_VELOCITY_DURATION_MS) : 0;
    const velocityX = velocityDurationMs > 0 ? deltaX / velocityDurationMs : 0;
    const velocityY = velocityDurationMs > 0 ? deltaY / velocityDurationMs : 0;
    let releaseVelocityX = lastDragVelocity.x;
    let releaseVelocityY = lastDragVelocity.y;
    const lastSample = lastDragSample;
    if (lastSample && endTime !== null && endTime >= lastSample.time) {
      const ageMs = endTime - lastSample.time;
      if (ageMs <= MAX_RELEASE_VELOCITY_AGE_MS) {
        const sampleDurationMs = Math.max(ageMs, MIN_RELEASE_VELOCITY_DURATION_MS);
        const deltaFromLastSampleX = resolvedDragOffset.x - lastSample.x;
        const deltaFromLastSampleY = resolvedDragOffset.y - lastSample.y;
        const sampleVelocityX = deltaFromLastSampleX / sampleDurationMs;
        const sampleVelocityY = deltaFromLastSampleY / sampleDurationMs;
        if (sampleVelocityX !== 0) {
          releaseVelocityX = sampleVelocityX;
        }
        if (sampleVelocityY !== 0) {
          releaseVelocityY = sampleVelocityY;
        }
      } else {
        releaseVelocityX = 0;
        releaseVelocityY = 0;
      }
    }

    const releaseDecision = options.onRelease?.({
      event: toNativeEvent(event),
      direction: intendedSwipeDirection,
      deltaX,
      deltaY,
      velocityX,
      velocityY,
      releaseVelocityX,
      releaseVelocityY,
    });
    const hasReleaseDecision = typeof releaseDecision === 'boolean';

    if (cancelledSwipe && !hasReleaseDecision) {
      dragOffset = { x: resolvedInitialTransform.x, y: resolvedInitialTransform.y };
      setCurrentSwipeDirection(undefined);
      syncDragStyles(false);
      updateSwipeProgress(0, progressDetails);
      return;
    }

    let shouldClose = false;
    let dismissDirection: SwipeDirection | undefined;

    if (hasReleaseDecision) {
      shouldClose = releaseDecision;
      dismissDirection = intendedSwipeDirection ?? primaryDirection();
    } else {
      for (const direction of directions()) {
        if (getDisplacement(direction, deltaX, deltaY) > swipeThreshold) {
          shouldClose = true;
          dismissDirection = direction;
          break;
        }
      }
    }

    if (shouldClose && dismissDirection) {
      setCurrentSwipeDirection(dismissDirection);
      setDragDismissed(true);
      syncDragStyles(false);
      options.onDismiss?.(toNativeEvent(event), { direction: dismissDirection });
    } else {
      dragOffset = { x: resolvedInitialTransform.x, y: resolvedInitialTransform.y };
      setCurrentSwipeDirection(undefined);
      syncDragStyles(false);
      updateSwipeProgress(0, progressDetails);
    }
  };

  const handleMove = (event: SwipeDismissMoveEvent) => {
    const currentPos = getPrimaryPointerPosition(event);
    if (!currentPos) {
      return;
    }

    let endAfterMove = false;

    if (!('touches' in event)) {
      const hasPrimaryButton = hasPrimaryMouseButton(event.buttons);
      if (hasPrimaryButton) {
        sawPrimaryButtonsOnMove = true;
      }

      // Cancel the swipe if a non-primary button takes over the interaction.
      // This handles cases where a right-click interrupts dragging.
      if (event.buttons !== 0 && !hasPrimaryButton) {
        cancelSwipeInteraction(event);
        return;
      }

      // A `buttons: 0` pointermove means the primary button was already released, so the gesture is
      // over even if no pointerup reached us. On fast trackpad flicks this trailing move is
      // dispatched just before pointerup; treat it as the release (mirroring touchend) instead of
      // cancelling and snapping the element back.
      if (event.buttons === 0 && sawPrimaryButtonsOnMove) {
        if (!isSwipingCurrent) {
          // The gesture never activated — discard it.
          handleEnd(event);
          return;
        }
        // This release move can itself carry the threshold-crossing displacement (and the peak
        // release velocity), so let it flow through `handleMoveCore` below to update the drag
        // offset / velocity sample, then commit the release afterwards.
        endAfterMove = true;
      }
    }

    if (!isSwipingCurrent && pendingSwipe) {
      if (!isTouchLikeEvent(event) && event.defaultPrevented) {
        resetPendingSwipeState();
        return;
      }

      const allowedToStart = options.canStart
        ? options.canStart(currentPos, {
            nativeEvent: toNativeEvent(event),
            direction: primaryDirection(),
          })
        : true;

      if (allowedToStart) {
        const pendingStartPos = pendingSwipeStartPos;
        let ignoreScrollableOnStart = false;
        if (isTouchLikeEvent(event)) {
          const element = elementRef.current;
          if (pendingStartPos && element) {
            const target = getTargetAtPoint(currentPos, toNativeEvent(event));
            const doc = ownerDocument(element);
            const body = doc.body;
            const scrollTarget = body ? findGestureScrollableTouchTarget(target, body) : null;

            if (
              scrollTarget &&
              (contains(element, scrollTarget) || contains(scrollTarget, element))
            ) {
              const deltaX = currentPos.x - pendingStartPos.x;
              const deltaY = currentPos.y - pendingStartPos.y;
              const canSwipeFromEdge = canSwipeFromScrollEdgeOnPendingMove(
                scrollTarget,
                deltaX,
                deltaY,
              );

              if (canSwipeFromEdge === false) {
                return;
              }

              if (canSwipeFromEdge === true) {
                ignoreScrollableOnStart = true;
              }
            }
          }
        }

        const started = startSwipeAtPosition(event, currentPos, {
          ignoreScrollableTarget: ignoreScrollableOnStart,
          ignoreScrollableAncestors: ignoreScrollableOnStart,
        });
        if (started) {
          if (pendingStartPos && ignoreScrollableOnStart) {
            // Preserve displacement between touchstart and the move that activates swipe from
            // a scroll-edge so quick flicks can dismiss.
            clearPendingSwipeStartState();
            dragStartPos = pendingStartPos;
            swipeCancelBaseline = pendingStartPos;
            lastMovePos = pendingStartPos;
            isFirstPointerMove = false;
          } else {
            // Start from the current in-bounds position without dropping follow-up move
            // displacement; this avoids jumps when entering from outside the element while
            // keeping swipe tracking responsive on the next move.
            clearPendingSwipeStartState();
            swipeFromScrollable = false;
          }
        }
      }
    }

    const previousPos = lastMovePos;
    const movement =
      previousPos === null
        ? { x: 0, y: 0 }
        : { x: currentPos.x - previousPos.x, y: currentPos.y - previousPos.y };

    lastMovePos = currentPos;
    handleMoveCore(event, currentPos, movement);

    // `endAfterMove` is only set in the non-touch branch above; the `'touches'` guard re-narrows the
    // event type for `handleEnd` after the shared move handling has run.
    if (endAfterMove && !('touches' in event)) {
      handleEnd(event);
    }
  };

  // Feeds a native touchmove into the swipe pipeline. Used by consumers that claim the gesture
  // in a capture-phase listener and stop it from reaching the delegated touch handlers.
  const moveNative = (nativeEvent: TouchEvent, currentTarget: HTMLElement) => {
    handleMove({
      touches: nativeEvent.touches,
      currentTarget,
      nativeEvent,
      defaultPrevented: nativeEvent.defaultPrevented,
      timeStamp: nativeEvent.timeStamp,
    });
  };

  const getDragStyles = (): JSX.CSSProperties => {
    // Read the imperative `isSwipingCurrent`, not the lagging signal, to match the imperative
    // writer `syncDragStyles`. Otherwise a render that commits before the swiping write flushes
    // strips the transform it just wrote, flashing the popup to its resting position for a frame.
    const swiping = isSwipingCurrent;
    const deltaX = dragOffset.x - initialTransform.x;
    const deltaY = dragOffset.y - initialTransform.y;

    if (!swiping && deltaX === 0 && deltaY === 0 && !dragDismissed()) {
      return {
        [movementCssVars.x]: '0px',
        [movementCssVars.y]: '0px',
      } as JSX.CSSProperties;
    }

    return {
      transition: swiping ? 'none' : undefined,
      // While swiping, freeze the element at its current visual transform so it doesn't snap to the
      // end position.
      transform: swiping ? getDragTransform(dragOffset, initialTransform.scale) : undefined,
      [movementCssVars.x]: `${deltaX}px`,
      [movementCssVars.y]: `${deltaY}px`,
    } as JSX.CSSProperties;
  };

  // Unlike the React version, the handlers are returned even while disabled
  // (they no-op internally): Solid consumers call these once during setup, and
  // gating on the initial `enabled` value would permanently drop the handlers.
  const getPointerProps = () => {
    return {
      onPointerDown: handleStart,
      onPointerMove: handleMove,
      onPointerUp: handleEnd,
      onPointerCancel: handleEnd,
    } as const;
  };

  const getTouchProps = () => {
    return {
      onTouchStart: handleStart,
      onTouchMove: handleMove,
      onTouchEnd: handleEnd,
      onTouchCancel: handleEnd,
    } as const;
  };

  return {
    swiping: isSwiping,
    swipeDirection: currentSwipeDirection,
    dragDismissed,
    getPointerProps,
    getTouchProps,
    moveNative,
    getDragStyles,
    reset,
  };
}

export interface UseSwipeDismissState {}

export interface UseSwipeDismissDetails {
  nativeEvent: PointerEvent | TouchEvent;
  direction: SwipeDirection | undefined;
}

export type UseSwipeDismissProgressDetails = SwipeProgressDetailsInternal;

export interface UseSwipeDismissOptions {
  enabled: boolean;
  directions: SwipeDirection[];
  elementRef: RefObject<HTMLElement>;
  movementCssVars: { x: string; y: string };
  /**
   * The minimum distance (in pixels) the pointer must travel from the initial swipe point
   * before the gesture is considered a dismiss.
   * @default 40
   */
  swipeThreshold?:
    | number
    | ((details: { element: HTMLElement; direction: SwipeDirection }) => number)
    | undefined;
  /**
   * If provided, swiping will only begin once this returns true.
   * The predicate is evaluated on start and on subsequent move events while the pointer is down.
   */
  canStart?:
    | ((position: { x: number; y: number }, details: UseSwipeDismissDetails) => boolean)
    | undefined;
  /**
   * If true, swiping won't start when the gesture begins within a scrollable element.
   * This helps avoid conflicts between scrolling content and swipe-to-dismiss.
   * @default false
   */
  ignoreScrollableAncestors?: boolean | undefined;
  /**
   * If false, touch interactions can start swiping on interactive elements
   * that are ignored during pointer swipes.
   * @default true
   */
  ignoreSelectorWhenTouch?: boolean | undefined;
  /**
   * Whether to apply drag transform and movement styles to the element imperatively during a swipe.
   * Disable for event-only usage where the consumer drives styling itself.
   * @default true
   */
  trackDrag?: boolean | undefined;
  onSwipeStart?: ((event: PointerEvent | TouchEvent) => void) | undefined;
  onProgress?: ((progress: number, details?: UseSwipeDismissProgressDetails) => void) | undefined;
  onCancel?: ((event: PointerEvent | TouchEvent) => void) | undefined;
  /**
   * Called when the swipe interaction starts or ends.
   */
  onSwipingChange?: ((swiping: boolean) => void) | undefined;
  /**
   * Called when the swipe interaction ends. Returning `true` or `false`
   * overrides the default dismissal behavior.
   */
  onRelease?:
    | ((details: {
        event: PointerEvent | TouchEvent;
        direction: SwipeDirection | undefined;
        deltaX: number;
        deltaY: number;
        velocityX: number;
        velocityY: number;
        releaseVelocityX: number;
        releaseVelocityY: number;
      }) => boolean | void)
    | undefined;
  onDismiss?:
    | ((event: PointerEvent | TouchEvent, details: { direction: SwipeDirection }) => void)
    | undefined;
}

export interface UseSwipeDismissReturnValue {
  swiping: Accessor<boolean>;
  swipeDirection: Accessor<SwipeDirection | undefined>;
  dragDismissed: Accessor<boolean>;
  getPointerProps: () => {
    onPointerDown?: ((event: PointerEvent) => void) | undefined;
    onPointerMove?: ((event: PointerEvent) => void) | undefined;
    onPointerUp?: ((event: PointerEvent) => void) | undefined;
    onPointerCancel?: ((event: PointerEvent) => void) | undefined;
  };
  getTouchProps: () => {
    onTouchStart?: ((event: TouchEvent) => void) | undefined;
    onTouchMove?: ((event: TouchEvent) => void) | undefined;
    onTouchEnd?: ((event: TouchEvent) => void) | undefined;
    onTouchCancel?: ((event: TouchEvent) => void) | undefined;
  };
  moveNative: (nativeEvent: TouchEvent, currentTarget: HTMLElement) => void;
  getDragStyles: () => JSX.CSSProperties;
  reset: () => void;
}
