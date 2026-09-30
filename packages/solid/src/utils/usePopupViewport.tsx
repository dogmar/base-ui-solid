import {
  createEffect,
  createMemo,
  createRenderEffect,
  createSignal,
  flush,
  onCleanup,
  Show,
  untrack,
  type Accessor,
} from 'solid-js';
import type { JSX } from '@solidjs/web';
import { ownerDocument } from '@base-ui/utils/owner';
import { useAnimationFrame } from '../solid-utils/timers';
import { createRef } from '../solid-utils/refs';
import { useAnimationsFinished } from '../internals/useAnimationsFinished';
import type { StateAttributesMapping } from '../internals/getStateAttributesProps';
import { useDirection } from '../internals/direction-context/DirectionContext';
import { usePopupAutoResize } from './usePopupAutoResize';
import type { Dimensions } from '../floating-ui-react/types';
import type { Side } from '../internals/useAnchorPositioning';
import type { Store } from '../solid-utils/store';
import { adaptiveOrigin } from './adaptiveOriginMiddleware';
import * as CommonPopupCssVars from './CommonPopupCssVars';
import * as CommonViewportDataAttributes from './CommonViewportDataAttributes';

export const popupViewportStateMapping: StateAttributesMapping<{
  activationDirection: string | undefined;
}> = {
  activationDirection: (value) =>
    value
      ? {
          [CommonViewportDataAttributes.activationDirection]: value,
        }
      : null,
};

export interface PopupViewportState {
  /**
   * Direction from which the popup was activated, used for directional animations.
   */
  activationDirection: string | undefined;
  /**
   * Whether the viewport is currently transitioning between contents.
   */
  transitioning: boolean;
}

type PopupViewportStore = Pick<Store<any, any, any>, 'useState' | 'set'>;

export interface UsePopupViewportParameters {
  /**
   * Popup store instance for accessing shared popup state.
   */
  store: PopupViewportStore;
  /**
   * Side of the positioner relative to the trigger. Reactive; use a getter.
   */
  side: Side;
  /**
   * Viewport children to render in the current container. Reactive; accessed lazily,
   * and re-evaluated whenever the content must remount.
   */
  children?: JSX.Element | undefined;
}

export interface UsePopupViewportResult {
  /**
   * The viewport children wrapped in current/previous containers as needed.
   */
  children: JSX.Element;
  /**
   * Viewport state used for data attributes and render prop styling.
   * The fields are reactive getters.
   */
  state: PopupViewportState;
}

/**
 * Builds morphing viewport containers for popups that animate between trigger-based content.
 * Handles previous-content snapshots, auto-resize, and state attributes for transitions.
 */
export function usePopupViewport(parameters: UsePopupViewportParameters): UsePopupViewportResult {
  const { store } = parameters;

  const direction = useDirection();

  const activeTrigger = store.useState('activeTriggerElement') as Accessor<Element | null>;
  const activeTriggerId = store.useState('activeTriggerId') as Accessor<string | null>;
  const open = store.useState('open') as Accessor<boolean>;
  const payload = store.useState('payload') as Accessor<unknown>;
  const mounted = store.useState('mounted') as Accessor<boolean>;
  const popupElement = store.useState('popupElement') as Accessor<HTMLElement | null>;
  const positionerElement = store.useState('positionerElement') as Accessor<HTMLElement | null>;

  const previousActiveTrigger = usePreviousValue(() => (open() ? activeTrigger() : null));
  // Remount current content on trigger changes (and once more when payload lags) to avoid DOM reuse flashes.
  // The key bumps immediately on trigger switches, then again if the payload arrives on a later pass.
  const currentContentKey = usePopupContentKey(activeTriggerId, payload);

  let capturedNode: HTMLElement | null = null;
  const [previousContentNode, setPreviousContentNode] = createSignal<HTMLElement | null>(null, {
    ownedWrite: true,
  });

  const [newTriggerOffset, setNewTriggerOffset] = createSignal<Offset | null>(null, {
    ownedWrite: true,
  });

  const currentContainerRef = createRef<HTMLDivElement>();
  const previousContainerRef = createRef<HTMLDivElement>();

  const onAnimationsFinished = useAnimationsFinished(currentContainerRef, true);
  const cleanupFrame = useAnimationFrame();
  let cleanupController: AbortController | null = null;

  const [previousContentDimensions, setPreviousContentDimensions] = createSignal<{
    width: number;
    height: number;
  } | null>(null, { ownedWrite: true });

  const [showStartingStyleAttribute, setShowStartingStyleAttribute] = createSignal(false, {
    ownedWrite: true,
  });

  // Guarded per PORTING.md rule 20a: register the adaptive origin middleware once
  // and release it on unmount.
  let adaptiveOriginRegistered = false;
  createRenderEffect(
    () => {},
    () => {
      if (!adaptiveOriginRegistered) {
        adaptiveOriginRegistered = true;
        store.set('adaptiveOrigin', adaptiveOrigin);
      }
    },
  );
  void onCleanup(() => {
    if (adaptiveOriginRegistered) {
      adaptiveOriginRegistered = false;
      store.set('adaptiveOrigin', undefined);
    }
  });

  const handleMeasureLayout = () => {
    currentContainerRef.current?.style.setProperty('animation', 'none');
    currentContainerRef.current?.style.setProperty('transition', 'none');

    previousContainerRef.current?.style.setProperty('display', 'none');
  };

  const handleMeasureLayoutComplete = (previousDimensions: Dimensions | null) => {
    currentContainerRef.current?.style.removeProperty('animation');
    currentContainerRef.current?.style.removeProperty('transition');

    previousContainerRef.current?.style.removeProperty('display');

    if (previousDimensions) {
      setPreviousContentDimensions(previousDimensions);
    }
  };

  const armViewportCleanup = () => {
    cleanupController?.abort();
    const controller = new AbortController();
    cleanupController = controller;
    onAnimationsFinished(() => {
      setPreviousContentNode(null);
      setPreviousContentDimensions(null);
      capturedNode = null;
    }, controller.signal);
  };

  let lastHandledTrigger: Element | null = null;

  createRenderEffect(
    () => ({ open: open(), mounted: mounted() }),
    (current) => {
      if (!current.open || !current.mounted) {
        lastHandledTrigger = null;
      }
    },
  );

  createRenderEffect(
    () => ({
      activeTrigger: activeTrigger(),
      previousActiveTrigger: previousActiveTrigger(),
    }),
    (current) => {
      // When a trigger changes, set the captured children HTML to state,
      // so we can render both new and old content.
      if (
        current.activeTrigger &&
        current.previousActiveTrigger &&
        current.activeTrigger !== current.previousActiveTrigger &&
        lastHandledTrigger !== current.activeTrigger &&
        capturedNode
      ) {
        setPreviousContentNode(capturedNode);
        setShowStartingStyleAttribute(true);

        // Calculate the relative position between the previous and new trigger,
        // so we can pass it to the style hook for animation purposes.
        const offset = calculateRelativePosition(
          current.previousActiveTrigger,
          current.activeTrigger,
        );
        setNewTriggerOffset(offset);

        lastHandledTrigger = current.activeTrigger;
      }
    },
  );

  // Arm cleanup after a trigger change, and re-arm it if the current container remounts
  // mid-transition when a lagging payload bumps `currentContentKey`. The remount discards
  // the running entry animation (and with transition-style CSS the replacement mounts at
  // final styles with no animation at all), so re-run the starting-style choreography —
  // otherwise the watcher either strands or fires before the previous container's exit
  // animation finishes.
  // Guarded per PORTING.md rule 20a so a spurious re-apply cannot restart the choreography.
  let lastChoreography: { key: string; node: HTMLElement } | null = null;
  createRenderEffect(
    () => ({ key: currentContentKey(), node: previousContentNode() }),
    (current) => {
      if (current.node == null) {
        lastChoreography = null;
        return;
      }

      if (
        lastChoreography &&
        lastChoreography.key === current.key &&
        lastChoreography.node === current.node
      ) {
        return;
      }
      lastChoreography = { key: current.key, node: current.node };

      // Abort the stale watcher synchronously. The remount cancels the old container's
      // animations, and the resulting promise rejection would otherwise run the cleanup
      // in a microtask before the re-armed watcher below is in place.
      cleanupController?.abort();

      setShowStartingStyleAttribute(true);

      cleanupFrame.request(() => {
        // Commit synchronously (the Solid equivalent of React's `flushSync`).
        setShowStartingStyleAttribute(false);
        flush();
        armViewportCleanup();
      });
    },
  );

  // Capture a clone of the current content DOM subtree when the content changes.
  // We can't store previous JSX nodes as they may be stateful; instead we capture DOM clones
  // for visual continuity.
  //
  // Solid port note: React re-captured on every render. Solid has no per-render hook, so the
  // capture tracks the values that drive content changes (the content key, the payload and the
  // active trigger) and runs as an after-render effect so the clone reflects the committed DOM.
  createEffect(
    () => ({ key: currentContentKey(), payload: payload(), trigger: activeTrigger() }),
    () => {
      // When a transition is in progress, we store the next content in `capturedNode`.
      // This handles the case where the trigger changes multiple times before the transition
      // finishes. We want to always capture the latest content for the previous snapshot.
      // So clicking quickly on T1, T2, T3 will result in the following sequence:
      // 1. T1 -> T2: previousContent = T1, currentContent = T2
      // 2. T2 -> T3: previousContent = T2, currentContent = T3
      const source = currentContainerRef.current;
      if (!source) {
        return;
      }

      const wrapper = ownerDocument(source).createElement('div');
      for (const child of Array.from(source.childNodes)) {
        wrapper.appendChild(child.cloneNode(true));
      }

      capturedNode = wrapper;
    },
  );

  const isTransitioning = createMemo(() => previousContentNode() != null);

  // Re-created whenever `currentContentKey` changes — the Solid equivalent of React's `key`
  // remounts. Evaluating `parameters.children` inside the fresh container builds a fresh
  // DOM subtree; reactivity inside the children flows through their own computations.
  const currentContainer = createMemo(() => {
    currentContentKey();
    return untrack(() => (
      <div
        data-current
        ref={(el: HTMLDivElement) => {
          currentContainerRef.current = el;
        }}
        data-starting-style={isTransitioning() && showStartingStyleAttribute() ? '' : undefined}
      >
        {parameters.children}
      </div>
    ));
  });

  const childrenToRender = (
    <>
      <Show when={isTransitioning()}>
        <div
          data-previous
          inert
          ref={(el: HTMLDivElement) => {
            previousContainerRef.current = el;
          }}
          style={{
            ...(previousContentDimensions()
              ? {
                  [CommonPopupCssVars.popupWidth]: `${previousContentDimensions()!.width}px`,
                  [CommonPopupCssVars.popupHeight]: `${previousContentDimensions()!.height}px`,
                }
              : null),
            position: 'absolute',
          }}
          data-ending-style={showStartingStyleAttribute() ? undefined : ''}
        />
      </Show>
      {currentContainer()}
    </>
  );

  // When previousContentNode is present, imperatively populate the previous container with the
  // cloned children.
  createEffect(
    () => previousContentNode(),
    (node) => {
      const container = previousContainerRef.current;
      if (!container || !node) {
        return;
      }

      container.replaceChildren(...Array.from(node.childNodes));
    },
  );

  usePopupAutoResize({
    get popupElement() {
      return popupElement();
    },
    get positionerElement() {
      return positionerElement();
    },
    get mounted() {
      return mounted();
    },
    get content() {
      return payload();
    },
    onMeasureLayout: handleMeasureLayout,
    onMeasureLayoutComplete: handleMeasureLayoutComplete,
    get side() {
      return parameters.side;
    },
    get direction() {
      return direction();
    },
  });

  const state: PopupViewportState = {
    get activationDirection() {
      return getActivationDirection(newTriggerOffset());
    },
    get transitioning() {
      return isTransitioning();
    },
  };

  return { children: childrenToRender, state };
}

type Offset = {
  horizontal: number;
  vertical: number;
};

/**
 * Returns a string describing the provided offset.
 * It describes both the horizontal and vertical offset, separated by a space.
 *
 * @param offset
 */
function getActivationDirection(offset: Offset | null): string | undefined {
  if (!offset) {
    return undefined;
  }

  return `${getValueWithTolerance(offset.horizontal, 5, 'right', 'left')} ${getValueWithTolerance(offset.vertical, 5, 'down', 'up')}`;
}

/**
 * Returns a label describing the value (positive/negative) treating values
 * within tolerance as zero.
 *
 * @param value Value to check
 * @param tolerance Tolerance to treat the value as zero.
 * @param positiveLabel
 * @param negativeLabel
 * @returns If 0 < abs(value) < tolerance, returns an empty string. Otherwise returns positiveLabel or negativeLabel.
 */
function getValueWithTolerance(
  value: number,
  tolerance: number,
  positiveLabel: string,
  negativeLabel: string,
) {
  if (value > tolerance) {
    return positiveLabel;
  }

  if (value < -tolerance) {
    return negativeLabel;
  }

  return '';
}

/**
 * Calculates the relative position between centers of two elements.
 */
function calculateRelativePosition(from: Element, to: Element): Offset {
  const fromRect = from.getBoundingClientRect();
  const toRect = to.getBoundingClientRect();

  const fromCenter = {
    x: fromRect.left + fromRect.width / 2,
    y: fromRect.top + fromRect.height / 2,
  };
  const toCenter = {
    x: toRect.left + toRect.width / 2,
    y: toRect.top + toRect.height / 2,
  };

  return {
    horizontal: toCenter.x - fromCenter.x,
    vertical: toCenter.y - fromCenter.y,
  };
}

/**
 * Returns the previous distinct value of the accessor, or `null` before the first change.
 * Local Solid equivalent of `usePreviousValue` from `@base-ui/utils/usePreviousValue`
 * (which is a React hook).
 */
function usePreviousValue<T>(value: Accessor<T>): Accessor<T | null> {
  let current: T = untrack(value);
  let previous: T | null = null;

  return createMemo(() => {
    const next = value();
    if (!Object.is(next, current)) {
      previous = current;
      current = next;
    }
    return previous;
  });
}

/**
 * Returns a key that forces remounting content when triggers change or a payload is updated.
 */
function usePopupContentKey(
  activeTriggerId: Accessor<string | null>,
  payload: Accessor<unknown>,
): Accessor<string> {
  const [contentKey, setContentKey] = createSignal(0, { ownedWrite: true });
  let previousActiveTriggerId = untrack(activeTriggerId);
  let previousPayload = untrack(payload);
  let pendingPayloadUpdate = false;

  createRenderEffect(
    () => ({ activeTriggerId: activeTriggerId(), payload: payload() }),
    (current) => {
      // Compare against the last committed values to decide whether we need a new DOM subtree.
      const triggerIdChanged = current.activeTriggerId !== previousActiveTriggerId;
      const payloadChanged = current.payload !== previousPayload;

      if (triggerIdChanged) {
        // Remount immediately on trigger change; remember if payload hasn't caught up yet.
        setContentKey((value) => value + 1);
        pendingPayloadUpdate = !payloadChanged;
      } else if (pendingPayloadUpdate && payloadChanged) {
        // Payload arrived a pass later, so remount once more to avoid reusing the old <img>.
        setContentKey((value) => value + 1);
        pendingPayloadUpdate = false;
      }

      // Persist current values for the next pass's comparison.
      previousActiveTriggerId = current.activeTriggerId;
      previousPayload = current.payload;
    },
  );

  return createMemo(() => `${activeTriggerId() ?? 'current'}-${contentKey()}`);
}
