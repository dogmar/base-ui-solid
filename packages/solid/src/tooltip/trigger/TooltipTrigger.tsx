import { createMemo, omit, untrack, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { isElement } from '@floating-ui/utils/dom';
import { useTooltipRootContext } from '../root/TooltipRootContext';
import type { BaseUIComponentProps, BaseUIEvent } from '../../internals/types';
import { triggerOpenStateMapping } from '../../utils/popupStateMapping';
import { useRenderElement } from '../../internals/useRenderElement';
import { usePopupHandleStore, useTriggerDataForwarding } from '../../utils/popups';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { TooltipHandle } from '../store/TooltipHandle';
import type { TooltipHandleStore } from '../store/TooltipStore';
import { useTooltipProviderContext } from '../provider/TooltipProviderContext';
import {
  safePolygon,
  useDelayGroup,
  useFocus,
  useHoverReferenceInteraction,
} from '../../floating-ui-react';
import { contains } from '../../floating-ui-react/utils/element';
import { isMouseLikePointerType } from '../../floating-ui-react/utils/event';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useHoverInteractionSharedState } from '../../floating-ui-react/hooks/useHoverInteractionSharedState';
import { getDelay } from '../../floating-ui-react/hooks/useHoverShared';
import { mergeProps } from '../../merge-props';
import { createRef } from '../../solid-utils/refs';
import { useTimeout } from '../../solid-utils/timers';
import { IsolateChildren } from '../../solid-utils/isolateChildren';
import * as TooltipTriggerDataAttributes from './TooltipTriggerDataAttributes';

import { OPEN_DELAY } from '../utils/constants';

const TOOLTIP_TRIGGER_IDENTIFIER = 'data-base-ui-tooltip-trigger';

function getTargetElement(event: Event): Element | null {
  if ('composedPath' in event) {
    const path = event.composedPath();
    for (let i = 0; i < path.length; i += 1) {
      const element = path[i];
      if (isElement(element)) {
        return element;
      }
    }
  }

  const target = event.target;
  if (isElement(target)) {
    return target;
  }

  return null;
}

function closestEnabledTooltipTrigger(element: Element | null): Element | null {
  let current = element;
  while (current) {
    const trigger = current.closest(`[${TOOLTIP_TRIGGER_IDENTIFIER}]`);
    if (trigger) {
      return trigger;
    }

    const root = current.getRootNode();
    current = 'host' in root && isElement(root.host) ? root.host : null;
  }

  return null;
}

/**
 * An element to attach the tooltip to.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Tooltip](https://base-ui.com/react/components/tooltip)
 */
export function TooltipTrigger<Payload = unknown>(
  componentProps: TooltipTrigger.Props<Payload>,
): JSX.Element {
  const rootContext = useTooltipRootContext(true);
  const handleStore = usePopupHandleStore<TooltipHandleStore<Payload>>(
    () => componentProps.handle,
  );

  if (untrack(() => componentProps.handle) === undefined && rootContext === undefined) {
    throw new Error(
      'Base UI: <Tooltip.Trigger> must be either used within a <Tooltip.Root> component or provided with a handle.',
    );
  }

  // The store the trigger reads from: the handle's currently exposed store, or the root context.
  // Solid components run once, so when the handle's store pointer changes (a root attaches or
  // detaches), the store-bound trigger scope below is re-created (the rendered element included).
  const store = createMemo(() => {
    const resolved =
      handleStore() ?? (rootContext as unknown as TooltipHandleStore<Payload> | undefined);
    if (!resolved) {
      throw new Error(
        'Base UI: <Tooltip.Trigger> must be either used within a <Tooltip.Root> component or provided with a handle.',
      );
    }
    return resolved;
  });

  return (
    <Show keyed when={store()}>
      {(currentStore) => TooltipTriggerImpl(componentProps, currentStore)}
    </Show>
  );
}

function TooltipTriggerImpl<Payload>(
  componentProps: TooltipTrigger.Props<Payload>,
  store: TooltipHandleStore<Payload>,
): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'className',
    'class',
    'style',
    'ref',
    'handle',
    'payload',
    'disabled',
    'delay',
    'closeOnClick',
    'closeDelay',
    'id',
  );

  const thisTriggerId = useBaseUiId(() => componentProps.id as string | undefined);
  const isTriggerActive = store.useState('isTriggerActive', thisTriggerId);
  const isOpenedByThisTrigger = store.useState('isOpenedByTrigger', thisTriggerId);
  const floatingRootContext = store.state.floatingRootContext;

  const triggerElementRef = createRef<Element>();

  const closeOnClick = () => componentProps.closeOnClick ?? true;
  const closeDelayWithDefault = () => componentProps.closeDelay ?? 0;

  const { registerTrigger, isMountedByThisTrigger } = useTriggerDataForwarding(
    thisTriggerId,
    triggerElementRef,
    store,
    {
      get payload() {
        return componentProps.payload;
      },
      get closeOnClick() {
        return closeOnClick();
      },
      get closeDelay() {
        return closeDelayWithDefault();
      },
    },
  );

  const providerDelay = useTooltipProviderContext();
  const { activeIdRef, delayRef, isInstantPhase, hasProvider } = useDelayGroup(
    floatingRootContext,
    {
      get open() {
        return isOpenedByThisTrigger();
      },
    },
  );
  const hoverInteraction = useHoverInteractionSharedState(floatingRootContext);

  store.useSyncedValue('isInstantPhase', isInstantPhase);

  const rootDisabled = store.useState('disabled');
  const disabled = () => componentProps.disabled ?? rootDisabled();
  const trackCursorAxis = store.useState('trackCursorAxis');
  const disableHoverablePopup = store.useState('disableHoverablePopup');

  let isNestedTriggerHovered = false;
  const nestedTriggerOpenTimeout = useTimeout();
  // Local copy so it can be cleared on mouseLeave without resetting the hover hook's own pointerType.
  let pointerType: string | undefined;

  function getOpenDelay() {
    // Adjacent tooltips open instantly while the group is active.
    if (hasProvider && activeIdRef.current != null) {
      return 0;
    }
    return untrack(() => componentProps.delay) ?? providerDelay?.() ?? OPEN_DELAY;
  }

  function isEnabledNestedTriggerTarget(target: Element | null) {
    const triggerEl = triggerElementRef.current;
    if (!triggerEl || !target) {
      return false;
    }

    const nearestTrigger = closestEnabledTooltipTrigger(target);
    return (
      nearestTrigger !== null && nearestTrigger !== triggerEl && contains(triggerEl, nearestTrigger)
    );
  }

  function detectNestedTriggerHover(target: Element | null) {
    const nestedTriggerHovered = isEnabledNestedTriggerTarget(target);

    isNestedTriggerHovered = nestedTriggerHovered;
    if (nestedTriggerHovered) {
      hoverInteraction.openChangeTimeout.clear();
      hoverInteraction.restTimeout.clear();
      hoverInteraction.restTimeoutPending = false;
      nestedTriggerOpenTimeout.clear();
    }
    return nestedTriggerHovered;
  }

  const hoverProps = useHoverReferenceInteraction(floatingRootContext, {
    get enabled() {
      return !disabled();
    },
    mouseOnly: true,
    move: false,
    get handleClose() {
      return !disableHoverablePopup() && trackCursorAxis() !== 'both' ? safePolygon() : null;
    },
    restMs: getOpenDelay,
    delay() {
      if (untrack(() => componentProps.closeDelay) == null && hasProvider) {
        return { close: getDelay(delayRef.current, 'close') };
      }
      return { close: untrack(closeDelayWithDefault) };
    },
    triggerElementRef,
    get isActiveTrigger() {
      return isTriggerActive();
    },
    isClosing: () => store.select('transitionStatus') === 'ending',
    shouldOpen() {
      return !isNestedTriggerHovered;
    },
  });

  const focus = useFocus(floatingRootContext, {
    get enabled() {
      return !disabled();
    },
  });

  const handleNestedTriggerHover = (event: MouseEvent) => {
    const wasNestedTriggerHovered = isNestedTriggerHovered;
    const target = getTargetElement(event);
    const nestedTriggerHovered = detectNestedTriggerHover(target);
    const triggerEl = triggerElementRef.current as HTMLElement | null;
    const targetInsideTrigger = triggerEl && target && contains(triggerEl, target);

    // Only close hover-opened parents. Focus/click-like opens remain owned by
    // their original interaction and should not be clobbered by nested hover.
    if (
      nestedTriggerHovered &&
      store.select('open') &&
      store.select('lastOpenChangeReason') === REASONS.triggerHover
    ) {
      store.setOpen(false, createChangeEventDetails(REASONS.triggerHover, event));
      return;
    }

    if (
      wasNestedTriggerHovered &&
      !nestedTriggerHovered &&
      targetInsideTrigger &&
      !untrack(disabled) &&
      !store.select('open') &&
      triggerEl &&
      // Match the hover hook's non-strict mouse fallback for mouse-only event sequences.
      isMouseLikePointerType(pointerType)
    ) {
      const open = () => {
        if (!isNestedTriggerHovered && !untrack(disabled) && !store.select('open')) {
          store.setOpen(true, createChangeEventDetails(REASONS.triggerHover, event, triggerEl));
        }
      };

      const openDelay = getOpenDelay();

      // With `move: false`, the hover hook only listens to mouseenter/mouseleave
      // on the parent trigger. Leaving a nested child for the parent area fires
      // no event the hook can react to, so reopen locally.
      if (openDelay === 0) {
        nestedTriggerOpenTimeout.clear();
        open();
      } else {
        nestedTriggerOpenTimeout.start(openDelay, open);
      }
    }
  };

  const rootTriggerProps = store.useState('triggerProps', isMountedByThisTrigger);
  const shouldApplyRootTriggerProps = () =>
    isMountedByThisTrigger() || trackCursorAxis() !== 'none';

  const state: TooltipTriggerState = {
    get open() {
      return isOpenedByThisTrigger();
    },
  };

  const element = useRenderElement('button', componentProps, {
    state,
    ref: [triggerElementRef, registerTrigger],
    props: [
      hoverProps,
      (merged) => mergeProps(merged, focus.reference),
      (merged) =>
        mergeProps(merged, shouldApplyRootTriggerProps() ? rootTriggerProps() : undefined),
      {
        onMouseOver(event: MouseEvent) {
          handleNestedTriggerHover(event);
        },
        // React's `onFocus` uses `focusin` semantics (it also fires for focus
        // changes on descendants), and the focus hook's props use `onFocusIn`.
        onFocusIn(event: FocusEvent) {
          if (isEnabledNestedTriggerTarget(getTargetElement(event))) {
            (event as BaseUIEvent<FocusEvent>).preventBaseUIHandler();
          }
        },
        onMouseLeave() {
          isNestedTriggerHovered = false;
          nestedTriggerOpenTimeout.clear();
          pointerType = undefined;
        },
        onPointerEnter(event: PointerEvent) {
          pointerType = event.pointerType;
        },
        onPointerDown(event: PointerEvent) {
          pointerType = event.pointerType;
          store.set('closeOnClick', untrack(closeOnClick));
          if (untrack(closeOnClick) && !store.select('open')) {
            store.cancelPendingOpen(event);
          }
        },
        onClick(event: MouseEvent) {
          if (untrack(closeOnClick) && !store.select('open')) {
            store.cancelPendingOpen(event);
          }
        },
        get id() {
          return thisTriggerId();
        },
        get [TooltipTriggerDataAttributes.triggerDisabled]() {
          return disabled() ? '' : undefined;
        },
        get [TOOLTIP_TRIGGER_IDENTIFIER]() {
          return disabled() ? undefined : '';
        },
      },
      elementProps,
    ],
    stateAttributesMapping: triggerOpenStateMapping,
  });

  // Isolated so re-resolutions of surrounding insertion scopes (a sibling
  // toggling in the same fragment) cannot re-create the trigger element,
  // which would churn trigger registration.
  return <IsolateChildren>{element}</IsolateChildren>;
}

export interface TooltipTriggerState {
  /**
   * Whether the tooltip is currently open and was opened by this trigger.
   */
  open: boolean;
}

export interface TooltipTriggerProps<Payload = unknown> extends BaseUIComponentProps<
  'button',
  TooltipTriggerState
> {
  /**
   * A handle to associate the trigger with a tooltip.
   */
  handle?: TooltipHandle<Payload> | undefined;
  /**
   * A payload to pass to the tooltip when it is opened.
   */
  payload?: Payload | undefined;
  /**
   * How long to wait before opening the tooltip on hover. Specified in milliseconds.
   * @default 600
   */
  delay?: number | undefined;
  /**
   * Whether the tooltip should close when this trigger is clicked.
   * @default true
   */
  closeOnClick?: boolean | undefined;
  /**
   * How long to wait before closing the tooltip. Specified in milliseconds.
   * @default 0
   */
  closeDelay?: number | undefined;
  /**
   * If `true`, the tooltip will not open when interacting with this trigger.
   * Note that this doesn't apply the `disabled` attribute to the trigger element.
   * If you want to disable the trigger element itself, you can pass the `disabled` prop to the trigger element via the `render` prop.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace TooltipTrigger {
  export type State = TooltipTriggerState;
  export type Props<Payload = unknown> = TooltipTriggerProps<Payload>;
}
