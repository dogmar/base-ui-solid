import { createEffect, createRenderEffect, createSignal, onCleanup, untrack, type Accessor } from 'solid-js';
import { addEventListener } from '@base-ui/utils/addEventListener';
import { AnimationFrame } from '@base-ui/utils/useAnimationFrame';
import { warn } from '@base-ui/utils/warn';
import { ownerWindow } from '@base-ui/utils/owner';
import type { HTMLProps } from '../../internals/types';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useAnimationsFinished } from '../../internals/useAnimationsFinished';
import { applyRef, createRef, type RefCallback, type RefInput } from '../../solid-utils/refs';
import * as CollapsiblePanelDataAttributes from './CollapsiblePanelDataAttributes';
import type { CollapsibleRoot } from '../root/CollapsibleRoot';
import type { TransitionStatus } from '../../internals/useTransitionStatus';

type AnimationType = 'css-transition' | 'css-animation' | 'none';

interface Dimensions {
  height: number | undefined;
  width: number | undefined;
}

const EMPTY_DIMENSIONS: Dimensions = {
  height: undefined,
  width: undefined,
};

/**
 * Solid port of `useCollapsiblePanel`. `parameters` should be a reactive object
 * (use getters for reactive values); reactive return values are accessors.
 */
export function useCollapsiblePanel(
  parameters: UseCollapsiblePanelParameters,
): UseCollapsiblePanelReturnValue {
  const panelRef = createRef<HTMLDivElement>();
  // Tracks the rendered element reactively so DOM effects re-run when the
  // panel remounts (`keepMounted={false}` closing and reopening).
  const [panelElement, setPanelElement] = createSignal<HTMLDivElement | null>(null, {
    ownedWrite: true,
  });

  let animationTypeRef: AnimationType | null = null;
  const [dimensions, setDimensionsUnwrapped] = createSignal<Dimensions>(EMPTY_DIMENSIONS, {
    ownedWrite: true,
  });
  let lastMeasuredDimensionsRef: Dimensions = EMPTY_DIMENSIONS;
  // `beforematch` should reveal the matched content immediately, so the next
  // open cycle skips author-defined motion once and then returns to normal.
  let shouldSkipNextOpenRef = false;
  // Keyframe mount animations on initially open panels cause a visible layout
  // shift during the first paint, so suppress that first open lifecycle until
  // the panel has been closed once.
  let shouldPreventMountAnimationRef = untrack(() => parameters.open);
  // Some open paths intentionally bypass motion, but the shared root transition
  // status still advances asynchronously. Override the panel to idle so its data
  // attributes and dimension cleanup reflect the immediate open state.
  const [forcePanelIdle, setForcePanelIdle] = createSignal(false, { ownedWrite: true });
  let pendingTemporaryStyleRestoreRef: (() => void) | null = null;

  const mergedPanelRef: RefCallback<HTMLDivElement> = (element) => {
    applyRef(parameters.externalRef, element);
    panelRef.current = element;
    setPanelElement(element);
  };

  // Only used to handle panel close
  const runOnceCloseAnimationsFinish = useAnimationsFinished(panelRef);

  const hidden = () => !parameters.open && !parameters.mounted;
  const panelTransitionStatus: Accessor<TransitionStatus> = () =>
    forcePanelIdle() ? 'idle' : parameters.transitionStatus;
  const shouldPreventOpenAnimation = () =>
    parameters.open &&
    // This variable is safe to read here: it is only written from committed
    // effect paths and gates one-shot motion suppression for the next open
    // lifecycle. It intentionally exposes the last committed motion snapshot.
    shouldPreventMountAnimationRef;
  const renderedDimensions: Accessor<Dimensions> = () => {
    const currentDimensions = dimensions();
    // `animationTypeRef` and `lastMeasuredDimensionsRef` hold the last committed
    // animation mode and measurement. This fallback only restores a previously
    // measured pixel size after the live dimensions state has been reset back to `auto`.
    if (
      !parameters.open &&
      parameters.mounted &&
      animationTypeRef === 'css-animation' &&
      currentDimensions.height === undefined &&
      currentDimensions.width === undefined
    ) {
      return lastMeasuredDimensionsRef;
    }
    return currentDimensions;
  };
  const shouldPersistHiddenTransitionStyles = () =>
    parameters.hiddenUntilFound && hidden() && animationTypeRef !== 'css-animation';

  // Most measured dimensions are reused later when CSS keyframe closes need a
  // pixel size after the rendered dimensions have been reset back to `auto`.
  // Passing `false` is only for clearing the current dimensions state.
  function setDimensions(nextDimensions: Dimensions, shouldCacheMeasurement: boolean = true) {
    if (shouldCacheMeasurement) {
      lastMeasuredDimensionsRef = nextDimensions;
    }

    setDimensionsUnwrapped(nextDimensions);
  }

  function restorePendingTemporaryStyle() {
    pendingTemporaryStyleRestoreRef?.();
    pendingTemporaryStyleRestoreRef = null;
  }

  function setPendingTemporaryStyleRestore(restore: () => void) {
    restorePendingTemporaryStyle();
    pendingTemporaryStyleRestoreRef = () => {
      pendingTemporaryStyleRestoreRef = null;
      restore();
    };
  }

  createRenderEffect(
    () => ({ forcePanelIdle: forcePanelIdle(), transitionStatus: parameters.transitionStatus }),
    (current) => {
      // `forcePanelIdle` is only a temporary override for open paths that skip
      // motion. Keep it active while the shared root still reports `starting`,
      // then drop it once the root transition state catches up.
      if (!current.forcePanelIdle || current.transitionStatus === 'starting') {
        return;
      }

      setForcePanelIdle(false);
    },
  );

  onCleanup(() => {
    restorePendingTemporaryStyle();
  });

  createEffect(
    () => ({
      panel: panelElement(),
      mounted: parameters.mounted,
      open: parameters.open,
      transitionStatus: parameters.transitionStatus,
      shouldPreventOpenAnimation: shouldPreventOpenAnimation(),
    }),
    (current) => {
      const { panel, mounted, open, transitionStatus } = current;
      if (!panel) {
        return undefined;
      }

      // `beforematch` can temporarily force a `0s` motion duration so the matched
      // content reveals immediately. Restore the authored duration before detecting
      // the next close animation type, otherwise that first close is misread as
      // "no motion" and the close transition or keyframe gets skipped.
      if (!open && pendingTemporaryStyleRestoreRef) {
        restorePendingTemporaryStyle();
      }

      const animationType = getAnimationType(panel, current.shouldPreventOpenAnimation);
      animationTypeRef = animationType;

      // Initially open keyframe panels skip their first paint animation to avoid
      // layout shift, but we still need to cache the expanded size so the first
      // close animation can start from pixels instead of `auto`.
      if (
        open &&
        transitionStatus === 'idle' &&
        shouldPreventMountAnimationRef &&
        animationType === 'css-animation'
      ) {
        lastMeasuredDimensionsRef = getDimensions(panel);
        return undefined;
      }

      // Handle the opening pass: measure the expanded size and, when necessary,
      // neutralize author-defined motion so the panel can open immediately.
      if (open && transitionStatus === 'starting') {
        // `beforematch` opens should reveal the panel immediately so find-in-page
        // does not wait for the author-defined transition or animation to finish.
        const skipNextOpen = shouldSkipNextOpenRef;
        shouldSkipNextOpenRef = false;

        if (animationType === 'none') {
          setDimensions(getDimensions(panel));
          setForcePanelIdle(true);
          return undefined;
        }

        if (animationType === 'css-transition') {
          const restoreLayoutStyles = resetLayoutStyles(panel);
          setDimensions(getDimensions(panel));

          if (!skipNextOpen) {
            return restoreLayoutStyles;
          }

          const restoreTransitionDuration = setTemporaryStyle(panel, 'transition-duration', '0s');
          setPendingTemporaryStyleRestore(restoreTransitionDuration);
          setForcePanelIdle(true);
          return restoreLayoutStyles;
        }

        setDimensions(getDimensions(panel));

        const restoreAnimationName = setTemporaryStyle(panel, 'animation-name', 'none');
        if (!skipNextOpen) {
          restoreAnimationName();
          return undefined;
        }

        const restoreAnimationDuration = setTemporaryStyle(panel, 'animation-duration', '0s');

        restoreAnimationName();
        setPendingTemporaryStyleRestore(restoreAnimationDuration);
        setForcePanelIdle(true);

        return undefined;
      }

      // Capture the current size as soon as close is requested, before the
      // deferred ending phase applies closed styles. This keeps close transitions
      // starting from a measured pixel value, including interrupted opens.
      if (!open && mounted && (transitionStatus === 'idle' || transitionStatus === 'starting')) {
        shouldPreventMountAnimationRef = false;

        if (animationType === 'none') {
          setDimensions(EMPTY_DIMENSIONS, false);
          parameters.setMounted(false);
          return undefined;
        }

        setDimensions(getDimensions(panel));
        return undefined;
      }

      if (transitionStatus !== 'ending') {
        return undefined;
      }

      // Reachable when `transitionStatus` already flipped to `ending` before this effect ran, so
      // the close branch above was skipped. Without motion there is nothing to wait for, so unmount
      // here instead of deferring to the animation-finished path below.
      if (animationType === 'none') {
        parameters.setMounted(false);
        return undefined;
      }

      const nextDimensions = getDimensions(panel);
      const hasMeasuredSize = nextDimensions.height > 0 || nextDimensions.width > 0;

      if (!hasMeasuredSize) {
        parameters.setMounted(false);
        return undefined;
      }

      setDimensions(nextDimensions);

      if (animationType === 'css-animation') {
        const restoreAnimationName = setTemporaryStyle(panel, 'animation-name', 'none');
        restoreAnimationName();
      }

      return undefined;
    },
  );

  useOpenChangeComplete({
    get enabled() {
      return parameters.open && parameters.mounted && panelTransitionStatus() === 'idle';
    },
    open: true,
    ref: panelRef,
    onComplete() {
      // An animation's `finished` microtask can resolve after the update that set `open` to
      // `false` but before this effect's cleanup aborts the callback, so re-check the latest
      // value here. Clearing the measured size in that window would make the close transition
      // start from `height: 0` instead of the expanded pixel height.
      if (!untrack(() => parameters.open)) {
        return;
      }

      setDimensions(EMPTY_DIMENSIONS, false);
    },
  });

  // Closing panels need extra sequencing beyond `useOpenChangeComplete`.
  // This effect runs after the `ending` render has committed, so
  // `[data-ending-style]` is already present. Chrome can still register the
  // exit transition one frame later when an Accordion closes one item while
  // opening another, so wait one frame before watching animations.
  // See https://github.com/mui/base-ui/issues/3099
  createEffect(
    () => ({
      open: parameters.open,
      mounted: parameters.mounted,
      panelTransitionStatus: panelTransitionStatus(),
    }),
    (current) => {
      if (current.open || !current.mounted || current.panelTransitionStatus !== 'ending') {
        return undefined;
      }

      const panel = panelRef.current;
      if (!panel) {
        return undefined;
      }

      const abortController = new AbortController();
      let endingStyleFrame = -1;

      function handleComplete() {
        // Same post-commit race as the `useOpenChangeComplete` callback above:
        // read the latest `open` value so a panel that has already reopened is
        // not dropped from the DOM.
        if (untrack(() => parameters.open)) {
          return;
        }

        parameters.setMounted(false);
        setDimensions(EMPTY_DIMENSIONS, false);
      }

      endingStyleFrame = AnimationFrame.request(() => {
        runOnceCloseAnimationsFinish(handleComplete, abortController.signal);
      });

      return () => {
        AnimationFrame.cancel(endingStyleFrame);
        abortController.abort();
      };
    },
  );

  createEffect(
    () => ({
      panel: panelElement(),
      hidden: hidden(),
      hiddenUntilFound: parameters.hiddenUntilFound,
    }),
    (current) => {
      if (!current.panel || !current.hiddenUntilFound || !current.hidden) {
        return;
      }

      // Solid renders the `hidden` prop as a boolean attribute, so the
      // `until-found` string value has to be forced in the DOM directly.
      current.panel.setAttribute('hidden', 'until-found');
    },
  );

  createEffect(
    () => panelElement(),
    function registerBeforeMatchListener(panel) {
      if (!panel) {
        return undefined;
      }

      function handleBeforeMatch(event: Event) {
        const eventDetails = createChangeEventDetails(REASONS.none, event);

        parameters.onOpenChange(true, eventDetails);

        if (eventDetails.isCanceled) {
          return;
        }

        shouldSkipNextOpenRef = true;
        parameters.setOpen(true);
      }

      return addEventListener(panel, 'beforematch', handleBeforeMatch);
    },
  );

  const shouldRender = () =>
    parameters.keepMounted || parameters.hiddenUntilFound || parameters.mounted || parameters.open;

  return {
    height: () => renderedDimensions().height,
    // A props getter keeps the `data-starting-style` key's presence conditional,
    // matching the conditional spread in the React implementation.
    props: (externalProps: HTMLProps) => {
      const panelProps: HTMLProps = {
        ...externalProps,
        hidden: hidden(),
        id: parameters.id,
      };

      if (shouldPersistHiddenTransitionStyles()) {
        panelProps[CollapsiblePanelDataAttributes.startingStyle] = '';
      }

      return panelProps;
    },
    ref: mergedPanelRef,
    shouldPreventOpenAnimation,
    shouldRender,
    transitionStatus: panelTransitionStatus,
    width: () => renderedDimensions().width,
  };
}

function getDimensions(element: HTMLElement) {
  return {
    height: element.scrollHeight,
    width: element.scrollWidth,
  };
}

function getAnimationType(
  element: HTMLElement,
  hasSuppressedMountAnimation: boolean,
): AnimationType {
  const panelStyles = ownerWindow(element).getComputedStyle(element);
  const hasAnimation =
    (panelStyles.animationName
      .split(',')
      .map((name) => name.trim())
      .some((name) => name !== '' && name !== 'none') ||
      hasSuppressedMountAnimation) &&
    hasNonZeroDuration(panelStyles.animationDuration);
  const hasTransition = hasNonZeroDuration(panelStyles.transitionDuration);

  if (hasAnimation && hasTransition) {
    /* istanbul ignore else -- `process.env.NODE_ENV` is a build-time constant under test */
    if (process.env.NODE_ENV !== 'production') {
      warn(
        'CSS transitions and CSS animations both detected on Collapsible or Accordion panel.',
        'Only one of either animation type should be used.',
      );
    }

    return 'css-transition';
  }

  if (hasTransition) {
    return 'css-transition';
  }

  if (hasAnimation) {
    return 'css-animation';
  }

  return 'none';
}

function hasNonZeroDuration(value: string) {
  return value
    .split(',')
    .map((part) => part.trim())
    .some((part) => part !== '' && Number.parseFloat(part) > 0);
}

/**
 * Temporarily overrides an inline style property and returns a cleanup that
 * restores the previous inline value and priority.
 * @param element - The element whose inline style should be updated.
 * @param property - The CSS property name to override.
 * @param value - The temporary value to assign.
 * @returns A cleanup function that restores the original inline style state.
 */
function setTemporaryStyle(element: HTMLElement, property: string, value: string): () => void {
  const previousValue = element.style.getPropertyValue(property);
  const previousPriority = element.style.getPropertyPriority(property);

  element.style.setProperty(property, value);

  return () => {
    if (previousValue === '') {
      element.style.removeProperty(property);
      return;
    }

    element.style.setProperty(property, previousValue, previousPriority);
  };
}

/**
 * Temporarily resets inline alignment styles that can distort scroll-based
 * size measurements, then restores them on the next animation frame.
 * @param element - The panel element being measured.
 * @returns A cleanup function that cancels the scheduled restore and reapplies
 * the original inline layout styles immediately.
 */
function resetLayoutStyles(element: HTMLElement): () => void {
  const originalLayoutStyles = {
    'justify-content': element.style.justifyContent,
    'align-items': element.style.alignItems,
    'align-content': element.style.alignContent,
    'justify-items': element.style.justifyItems,
  };

  Object.keys(originalLayoutStyles).forEach((key) => {
    element.style.setProperty(key, 'initial', 'important');
  });

  function restoreLayoutStyles() {
    Object.entries(originalLayoutStyles).forEach(([key, value]) => {
      if (value === '') {
        element.style.removeProperty(key);
        return;
      }

      element.style.setProperty(key, value);
    });
  }

  const frame = AnimationFrame.request(restoreLayoutStyles);

  return () => {
    AnimationFrame.cancel(frame);
    restoreLayoutStyles();
  };
}

export interface UseCollapsiblePanelParameters {
  externalRef: RefInput<HTMLDivElement> | undefined;
  /**
   * Allows the browser's built-in page search to find and expand the panel contents.
   *
   * Overrides the `keepMounted` prop and uses `hidden="until-found"`
   * to hide the element without removing it from the DOM.
   */
  hiddenUntilFound: boolean;
  /**
   * The `id` attribute of the panel.
   */
  id: string | undefined;
  /**
   * Whether to keep the element in the DOM while the panel is closed.
   * This prop is ignored when `hiddenUntilFound` is used.
   */
  keepMounted: boolean;
  /**
   * Whether the collapsible panel is mounted for transition and hidden-state
   * purposes. This can be `false` while the element remains in the DOM when
   * `keepMounted` or `hiddenUntilFound` is enabled.
   */
  mounted: boolean;
  onOpenChange: (open: boolean, eventDetails: CollapsibleRoot.ChangeEventDetails) => void;
  /**
   * Whether the collapsible panel is currently open.
   */
  open: boolean;
  setMounted: (nextMounted: boolean) => void;
  setOpen: (nextOpen: boolean) => void;
  transitionStatus: TransitionStatus;
}

export interface UseCollapsiblePanelReturnValue {
  height: Accessor<number | undefined>;
  props: (externalProps: HTMLProps) => HTMLProps;
  ref: RefCallback<HTMLDivElement>;
  shouldPreventOpenAnimation: Accessor<boolean>;
  shouldRender: Accessor<boolean>;
  transitionStatus: Accessor<TransitionStatus>;
  width: Accessor<number | undefined>;
}
