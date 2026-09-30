import { createEffect, createRenderEffect, createSignal, omit, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { ownerDocument } from '@base-ui/utils/owner';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import { useRenderElement } from '../../internals/useRenderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { NOOP } from '../../internals/noop';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { getDisplacement, useSwipeDismiss, type SwipeDirection } from '../../utils/useSwipeDismiss';
import { getElementTransform } from '../../utils/getElementTransform';
import * as DrawerPopupCssVars from '../popup/DrawerPopupCssVars';
import * as DrawerPopupDataAttributes from '../popup/DrawerPopupDataAttributes';
import * as DrawerBackdropCssVars from '../backdrop/DrawerBackdropCssVars';
import { useDrawerRootContext, type DrawerSwipeDirection } from '../root/DrawerRootContext';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { useTriggerRegistration } from '../../utils/popups';
import { useDrawerProviderContext } from '../provider/DrawerProviderContext';
import { isVirtualClick } from '../../floating-ui-react/utils/event';
import { createRef } from '../../solid-utils/refs';
import * as DrawerSwipeAreaDataAttributes from './DrawerSwipeAreaDataAttributes';

const DEFAULT_SWIPE_OPEN_RATIO = 0.5;
const MIN_SWIPE_START_DISTANCE = 1;
const VELOCITY_THRESHOLD = 0.1;
const FALLBACK_SWIPE_OPEN_THRESHOLD = 40;

const SWIPE_AREA_OPEN_HOOK: Record<string, string> = {
  [DrawerSwipeAreaDataAttributes.open]: '',
};

const SWIPE_AREA_CLOSED_HOOK: Record<string, string> = {
  [DrawerSwipeAreaDataAttributes.closed]: '',
};

const SWIPE_AREA_SWIPING_HOOK: Record<string, string> = {
  [DrawerSwipeAreaDataAttributes.swiping]: '',
};

const SWIPE_AREA_DISABLED_HOOK: Record<string, string> = {
  [DrawerSwipeAreaDataAttributes.disabled]: '',
};

const stateAttributesMapping: StateAttributesMapping<DrawerSwipeAreaState> = {
  open(value) {
    return value ? SWIPE_AREA_OPEN_HOOK : SWIPE_AREA_CLOSED_HOOK;
  },
  swiping(value) {
    return value ? SWIPE_AREA_SWIPING_HOOK : null;
  },
  swipeDirection(value) {
    return { [DrawerSwipeAreaDataAttributes.swipeDirection]: value };
  },
  disabled(value) {
    return value ? SWIPE_AREA_DISABLED_HOOK : null;
  },
};

const oppositeSwipeDirection: Record<DrawerSwipeDirection, DrawerSwipeDirection> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

function resolveTouchAction(direction: DrawerSwipeDirection) {
  return direction === 'left' || direction === 'right' ? 'pan-y' : 'pan-x';
}

/**
 * An invisible area that listens for swipe gestures to open the drawer.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Drawer](https://base-ui.com/react/components/drawer)
 */
export function DrawerSwipeArea(componentProps: DrawerSwipeArea.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'className',
    'class',
    'style',
    'ref',
    'disabled',
    'swipeDirection',
    'id',
  );

  const store = useDialogRootContext();
  const { swipeDirection, frontmostHeight, swipeAreaActiveRef } = useDrawerRootContext();
  const providerContext = useDrawerProviderContext();

  const disabled = () => componentProps.disabled ?? false;

  const [swipeActive, setSwipeActive] = createSignal(false, { ownedWrite: true });

  const swipeAreaRef = createRef<HTMLDivElement>();
  let swipeStartEvent: PointerEvent | TouchEvent | null = null;
  let openedBySwipe = false;
  const dragDelta = { x: 0, y: 0 };
  let closedOffset: number | null = null;
  let appliedSwipeStyles = false;
  let swipePopupElement: HTMLElement | null = null;
  let swipeBackdropElement: HTMLElement | null = null;
  let popupTransition: string | null = null;
  let releaseGuardCleanup: () => void = NOOP;

  const swipeAreaId = useBaseUiId(() => componentProps.id as string | undefined);
  const registerTrigger = useTriggerRegistration(swipeAreaId, store);

  // `registerTrigger` is stable, so the ref does not re-fire when the id changes: re-register the
  // rendered element here instead.
  createRenderEffect(
    () => swipeAreaId(),
    () => {
      registerTrigger(swipeAreaRef.current);
    },
  );
  onCleanup(() => registerTrigger(null));

  const open = store.useState('open');
  const mounted = store.useState('mounted');

  const resetDragDelta = () => {
    dragDelta.x = 0;
    dragDelta.y = 0;
  };

  const resolvedSwipeDirection = () =>
    componentProps.swipeDirection ?? oppositeSwipeDirection[swipeDirection()];
  const dismissDirection = () => oppositeSwipeDirection[resolvedSwipeDirection()];
  const enabled = () => !disabled() && (!open() || swipeActive());

  function disableDismissForSwipe() {
    releaseGuardCleanup();
    store.context.outsidePressEnabledRef.current = false;
  }

  const enableDismissAfterRelease = () => {
    releaseGuardCleanup();

    const doc = ownerDocument(swipeAreaRef.current);

    function restore(event?: MouseEvent) {
      // The gesture's trailing release click is the one physical click with no `pointerdown` of
      // its own. Ignore it and keep waiting, so it cannot dismiss the drawer it just opened,
      // while a click-only activation (keyboard or assistive tech) still re-enables in time.
      if (event?.type === 'click' && event.detail !== 0 && !isVirtualClick(event)) {
        return;
      }

      releaseGuardCleanup = NOOP;
      doc.removeEventListener('pointerdown', restore, true);
      doc.removeEventListener('click', restore, true);
      store.context.outsidePressEnabledRef.current = true;
    }

    // The pointerup that ends a swipe-open gesture synthesizes a `click`. When the drag released
    // outside the popup (e.g. it was dragged past the popup's size), that click would be treated as
    // an outside press and immediately dismiss the drawer that was just opened. Keep outside-press
    // dismissal disabled until the next interaction that isn't that release click: a deliberate
    // outside press starts with a `pointerdown`, and a click-only activation (keyboard or
    // assistive tech) is distinguishable from a physical release. This is deterministic, unlike
    // re-enabling on a timer that can race the synthesized click and dismiss at random.
    //
    // `restore` runs in document capture, ahead of floating-ui's own outside-press check (which
    // happens on the event target, after capture), so the triggering press still dismisses.
    releaseGuardCleanup = restore;
    doc.addEventListener('pointerdown', restore, true);
    doc.addEventListener('click', restore, true);
  };

  function getPopupSize(popupElement: HTMLElement) {
    const isHorizontal = dismissDirection() === 'left' || dismissDirection() === 'right';
    const size = isHorizontal ? popupElement.offsetWidth : popupElement.offsetHeight;
    if (size <= 0) {
      return null;
    }

    return size;
  }

  function resolvePopupSize() {
    const popupElement = store.context.popupRef.current;
    return popupElement ? getPopupSize(popupElement) : null;
  }

  function resolveClosedOffset(popupElement: HTMLElement) {
    const offset = getPopupSize(popupElement);
    if (offset == null) {
      return null;
    }

    const isHorizontal = dismissDirection() === 'left' || dismissDirection() === 'right';
    const transform = getElementTransform(popupElement);
    const transformOffset = isHorizontal ? transform.x : transform.y;
    if (Number.isFinite(transformOffset) && Math.abs(transformOffset) > 0.5) {
      return Math.min(offset, Math.abs(transformOffset));
    }

    return offset;
  }

  function resolveSwipeOpenThreshold() {
    const popupSize = resolvePopupSize();
    if (popupSize == null) {
      return FALLBACK_SWIPE_OPEN_THRESHOLD;
    }

    return popupSize * DEFAULT_SWIPE_OPEN_RATIO;
  }

  function applySwipeMovement() {
    const popupElement = store.context.popupRef.current;
    if (!popupElement) {
      return;
    }

    if (!store.select('open') || !store.select('mounted')) {
      return;
    }

    if (closedOffset == null) {
      closedOffset = resolveClosedOffset(popupElement);
    }

    if (closedOffset === null) {
      return;
    }

    const { x, y } = dragDelta;
    const displacement = getDisplacement(resolvedSwipeDirection(), x, y);
    const clampedDisplacement = Math.max(0, displacement);
    const dampedDisplacement =
      clampedDisplacement > closedOffset
        ? closedOffset + Math.sqrt(clampedDisplacement - closedOffset)
        : clampedDisplacement;
    const remaining = closedOffset - dampedDisplacement;
    const directionSign =
      dismissDirection() === 'left' || dismissDirection() === 'up' ? -1 : 1;
    const movement = remaining * directionSign;
    const isHorizontal = dismissDirection() === 'left' || dismissDirection() === 'right';
    const movementX = isHorizontal ? movement : 0;
    const movementY = isHorizontal ? 0 : movement;
    const openProgress = Math.max(0, Math.min(1, clampedDisplacement / closedOffset));
    const backdropProgress = Math.max(0, Math.min(1, 1 - openProgress));

    popupElement.style.setProperty(DrawerPopupCssVars.swipeMovementX, `${movementX}px`);
    popupElement.style.setProperty(DrawerPopupCssVars.swipeMovementY, `${movementY}px`);
    popupElement.setAttribute(DrawerPopupDataAttributes.swiping, '');
    swipePopupElement = popupElement;
    if (popupTransition === null) {
      popupTransition = popupElement.style.transition;
    }
    popupElement.style.transition = 'none';

    const backdropElement = store.context.backdropRef.current;
    if (backdropElement) {
      backdropElement.setAttribute(DrawerPopupDataAttributes.swiping, '');
      swipeBackdropElement = backdropElement;
      backdropElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, `${backdropProgress}`);
      const currentFrontmostHeight = untrack(frontmostHeight);
      if (openProgress > 0 && currentFrontmostHeight > 0) {
        backdropElement.style.setProperty(
          DrawerPopupCssVars.height,
          `${currentFrontmostHeight}px`,
        );
      } else {
        backdropElement.style.removeProperty(DrawerPopupCssVars.height);
      }
    }

    providerContext?.visualStateStore.set({
      swipeProgress: openProgress,
      frontmostHeight: openProgress > 0 ? untrack(frontmostHeight) : 0,
    });
    appliedSwipeStyles = true;
    swipeAreaActiveRef.current = true;
  }

  const clearSwipeStyles = () => {
    const popupElement = swipePopupElement;
    if (popupElement) {
      popupElement.style.removeProperty(DrawerPopupCssVars.swipeMovementX);
      popupElement.style.removeProperty(DrawerPopupCssVars.swipeMovementY);
      popupElement.removeAttribute(DrawerPopupDataAttributes.swiping);
    }

    if (popupElement && popupTransition !== null) {
      popupElement.style.transition = popupTransition;
      popupTransition = null;
    }

    const backdropElement = swipeBackdropElement;
    if (backdropElement) {
      backdropElement.removeAttribute(DrawerPopupDataAttributes.swiping);
      backdropElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, '0');
      backdropElement.style.removeProperty(DrawerPopupCssVars.height);
    }

    providerContext?.visualStateStore.set({ swipeProgress: 0, frontmostHeight: 0 });
    appliedSwipeStyles = false;
    swipePopupElement = null;
    swipeBackdropElement = null;
    swipeAreaActiveRef.current = false;
  };

  function openDrawer(event?: PointerEvent | TouchEvent) {
    openedBySwipe = true;
    store.setOpen(true, createChangeEventDetails(REASONS.swipe, event, swipeAreaRef.current!));
  }

  function closeDrawer(event?: PointerEvent | TouchEvent) {
    store.setOpen(false, createChangeEventDetails(REASONS.swipe, event, swipeAreaRef.current!));
  }

  function resetSwipeInteractionState() {
    swipeStartEvent = null;
    openedBySwipe = false;
    closedOffset = null;
    setSwipeActive(false);
  }

  function finishSwipeInteraction() {
    resetSwipeInteractionState();
    enableDismissAfterRelease();
    resetDragDelta();
    clearSwipeStyles();
  }

  const swipe = useSwipeDismiss({
    get enabled() {
      return enabled();
    },
    get directions() {
      return [resolvedSwipeDirection()];
    },
    elementRef: swipeAreaRef,
    trackDrag: false,
    movementCssVars: {
      x: DrawerPopupCssVars.swipeMovementX,
      y: DrawerPopupCssVars.swipeMovementY,
    },
    onSwipeStart(event) {
      disableDismissForSwipe();
      swipeStartEvent = event;
      openedBySwipe = false;
      setSwipeActive(true);
      resetDragDelta();
    },
    onProgress(_progress, details) {
      if (!details) {
        return;
      }

      if (!swipeStartEvent) {
        return;
      }

      dragDelta.x = details.deltaX;
      dragDelta.y = details.deltaY;

      if (details.direction !== untrack(resolvedSwipeDirection)) {
        return;
      }

      const displacement = getDisplacement(
        untrack(resolvedSwipeDirection),
        details.deltaX,
        details.deltaY,
      );
      if (!openedBySwipe && displacement < MIN_SWIPE_START_DISTANCE) {
        return;
      }

      if (!openedBySwipe && !store.select('open')) {
        openDrawer(swipeStartEvent);
      }

      applySwipeMovement();
    },
    onRelease({ event, direction, deltaX, deltaY, releaseVelocityX, releaseVelocityY }) {
      const displacement = getDisplacement(untrack(resolvedSwipeDirection), deltaX, deltaY);
      const releaseVelocity = getDisplacement(
        untrack(resolvedSwipeDirection),
        releaseVelocityX,
        releaseVelocityY,
      );
      const threshold = resolveSwipeOpenThreshold();
      const hasEnoughDistance = displacement >= threshold;
      const hasEnoughVelocity = releaseVelocity >= VELOCITY_THRESHOLD;
      const shouldOpen =
        direction === untrack(resolvedSwipeDirection) &&
        (hasEnoughDistance || hasEnoughVelocity) &&
        !untrack(disabled);

      if (shouldOpen) {
        if (!store.select('open')) {
          openDrawer(event);
        }
      } else if (openedBySwipe && store.select('open')) {
        closeDrawer(event);
      }

      finishSwipeInteraction();

      return false;
    },
    onCancel: finishSwipeInteraction,
  });

  const swipePointerProps = swipe.getPointerProps();
  const swipeTouchProps = swipe.getTouchProps();
  const resetSwipe = swipe.reset;

  // The commit that opens the drawer re-renders the popup, resetting `--swipe-movement-*` to `0px`
  // (the viewport isn't swiping). Re-assert after the DOM mutation but before paint. No deps in the
  // React version (runs on every commit); here it re-runs whenever the open/mounted popup state or
  // the swipe activity changes.
  createRenderEffect(
    () => ({ swipeActive: swipeActive(), open: open(), mounted: mounted() }),
    () => {
      if (untrack(swipeActive) && appliedSwipeStyles) {
        applySwipeMovement();
      }
    },
  );

  createRenderEffect(
    () => ({ enabled: enabled(), swipeActive: swipeActive() }),
    (current) => {
      if (!current.enabled) {
        if (current.swipeActive) {
          enableDismissAfterRelease();
        }
        resetSwipe();
        resetDragDelta();
        clearSwipeStyles();
        resetSwipeInteractionState();
      }
    },
  );

  createEffect(
    () => null,
    () => {
      return () => {
        releaseGuardCleanup();
        store.context.outsidePressEnabledRef.current = true;
      };
    },
  );

  const state: DrawerSwipeAreaState = {
    get open() {
      return open();
    },
    get swiping() {
      return swipe.swiping();
    },
    get swipeDirection() {
      return resolvedSwipeDirection();
    },
    get disabled() {
      return disabled();
    },
  };

  return useRenderElement('div', componentProps, {
    state,
    ref: [swipeAreaRef, registerTrigger],
    stateAttributesMapping,
    props: [
      {
        role: 'presentation' as const,
        'aria-hidden': 'true',
        get style() {
          return {
            'pointer-events': !enabled() ? ('none' as const) : undefined,
            'touch-action': resolveTouchAction(resolvedSwipeDirection()),
          } as JSX.CSSProperties;
        },
        onPointerDown(event: PointerEvent) {
          if (event.pointerType === 'touch') {
            return;
          }
          swipePointerProps.onPointerDown?.(event);

          // Prevent native text selection/drag gestures from competing with swipe-open dragging.
          if (event.cancelable) {
            event.preventDefault();
          }
        },
        onPointerMove(event: PointerEvent) {
          if (event.pointerType === 'touch') {
            return;
          }
          swipePointerProps.onPointerMove?.(event);
        },
        onPointerUp(event: PointerEvent) {
          if (event.pointerType === 'touch') {
            return;
          }
          swipePointerProps.onPointerUp?.(event);
        },
        onPointerCancel(event: PointerEvent) {
          if (event.pointerType === 'touch') {
            return;
          }
          swipePointerProps.onPointerCancel?.(event);
        },
      },
      swipeTouchProps,
      {
        get id() {
          return swipeAreaId();
        },
      },
      elementProps,
    ],
  });
}

export interface DrawerSwipeAreaProps extends BaseUIComponentProps<'div', DrawerSwipeAreaState> {
  /**
   * Whether the swipe area is disabled.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * The swipe direction that opens the drawer.
   * Defaults to the opposite of `Drawer.Root` `swipeDirection`.
   */
  swipeDirection?: DrawerSwipeDirection | undefined;
}

export interface DrawerSwipeAreaState {
  /**
   * Whether the drawer is currently open.
   */
  open: boolean;
  /**
   * Whether the swipe area is currently being swiped.
   */
  swiping: boolean;
  /**
   * The swipe direction that opens the drawer.
   */
  swipeDirection: SwipeDirection;
  /**
   * Whether the swipe area is disabled.
   */
  disabled: boolean;
}

export namespace DrawerSwipeArea {
  export type Props = DrawerSwipeAreaProps;
  export type State = DrawerSwipeAreaState;
}
