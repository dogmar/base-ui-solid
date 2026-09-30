import { createMemo, createRenderEffect, onCleanup, untrack, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { EMPTY_OBJECT } from '@base-ui/utils/empty';
import { IsolateChildren } from '../../solid-utils/isolateChildren';
import { TooltipRootContext } from './TooltipRootContext';
import { useClientPoint, useDismiss } from '../../floating-ui-react';
import {
  type BaseUIChangeEventDetails,
  createChangeEventDetails,
} from '../../internals/createBaseUIEventDetails';
import {
  PopupHandleAttachment,
  useImplicitActiveTrigger,
  usePopupRootStore,
  useOpenStateTransitions,
  usePopupInteractionProps,
  type PayloadChildRenderFunction,
} from '../../utils/popups';
import { mergeProps } from '../../merge-props';
import { applyRef, type RefObject } from '../../solid-utils/refs';
import { TooltipStore, type State as TooltipStoreState } from '../store/TooltipStore';
import { type TooltipHandle } from '../store/TooltipHandle';
import { REASONS } from '../../internals/reasons';

/**
 * Groups all parts of the tooltip.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Tooltip](https://base-ui.com/react/components/tooltip)
 */
export function TooltipRoot<Payload = unknown>(props: TooltipRoot.Props<Payload>): JSX.Element {
  const disabled = () => props.disabled ?? false;
  const trackCursorAxis = () => props.trackCursorAxis ?? 'none';

  const store = usePopupRootStore(
    (floatingId, nested) =>
      new TooltipStore<Payload>(
        untrack(() => ({
          open: props.defaultOpen ?? false,
          openProp: props.open,
          activeTriggerId: props.defaultTriggerId ?? null,
          triggerIdProp: props.triggerId,
        })),
        floatingId,
        nested,
      ),
  );

  store.useControlledProp('openProp', () => props.open);
  store.useControlledProp('triggerIdProp', () => props.triggerId);

  store.useContextCallback('onOpenChange', () => props.onOpenChange);
  store.useContextCallback('onOpenChangeComplete', () => props.onOpenChangeComplete);

  const openState = store.useState('open');
  const open = () => !disabled() && openState();

  const activeTriggerId = store.useState('activeTriggerId');
  const mounted = store.useState('mounted');
  const payload = store.useState('payload') as () => Payload | undefined;

  store.useSyncedValues({
    get trackCursorAxis() {
      return trackCursorAxis();
    },
    get disableHoverablePopup() {
      return props.disableHoverablePopup ?? false;
    },
    get disabled() {
      return disabled();
    },
  });

  useImplicitActiveTrigger(store, { closeOnActiveTriggerUnmount: true });
  const { forceUnmount, transitionStatus } = useOpenStateTransitions(open, store);
  const isInstantPhase = store.useState('isInstantPhase');
  const instantType = store.useState('instantType');
  const lastOpenChangeReason = store.useState('lastOpenChangeReason');

  // Animations should be instant in two cases:
  // 1) Opening during the provider's instant phase (adjacent tooltip opens instantly)
  // 2) Closing because another tooltip opened (reason === 'none')
  // Otherwise, allow the animation to play. In particular, do not disable animations
  // during the 'ending' phase unless it's due to a sibling opening.
  let previousInstantType: TooltipStoreState<Payload>['instantType'] | null = null;

  createRenderEffect(
    () => ({ openState: openState(), disabled: disabled() }),
    (current) => {
      if (current.openState && current.disabled) {
        store.setOpen(false, createChangeEventDetails(REASONS.disabled));
      }
    },
  );

  createRenderEffect(
    () => ({
      transitionStatus: transitionStatus(),
      isInstantPhase: isInstantPhase(),
      lastOpenChangeReason: lastOpenChangeReason(),
      instantType: instantType(),
    }),
    (current) => {
      if (
        (current.transitionStatus === 'ending' && current.lastOpenChangeReason === REASONS.none) ||
        (current.transitionStatus !== 'ending' && current.isInstantPhase)
      ) {
        // Capture the current instant type so we can restore it later
        // and set to 'delay' to disable animations while moving from one trigger to another
        // within a delay group.
        if (current.instantType !== 'delay') {
          previousInstantType = current.instantType;
        }
        store.set('instantType', 'delay');
      } else if (previousInstantType !== null) {
        store.set('instantType', previousInstantType);
        previousInstantType = null;
      }
    },
  );

  createRenderEffect(
    () => ({ open: open(), activeTriggerId: activeTriggerId() }),
    (current) => {
      if (current.open) {
        if (current.activeTriggerId == null) {
          store.set('payload', undefined);
        }
      }
    },
  );

  const actions: TooltipRoot.Actions = {
    unmount: forceUnmount,
    close: () => store.setOpen(false, createChangeEventDetails(REASONS.imperativeAction)),
  };

  createRenderEffect(
    () => props.actionsRef,
    (actionsRef) => {
      if (actionsRef) {
        applyRef(actionsRef, actions);
        return () => applyRef(actionsRef, null);
      }
      return undefined;
    },
  );
  void onCleanup(() => {
    const actionsRef = untrack(() => props.actionsRef);
    if (actionsRef && actionsRef.current === actions) {
      applyRef(actionsRef, null);
    }
  });

  const shouldRenderInteractions = () =>
    open() || mounted() || (!disabled() && trackCursorAxis() !== 'none');

  const resolveChildren = (): JSX.Element => {
    const children = untrack(() => props.children);
    if (typeof children === 'function') {
      return (children as PayloadChildRenderFunction<Payload>)({
        get payload() {
          return payload();
        },
      });
    }
    return props.children as JSX.Element;
  };

  return (
    <TooltipRootContext value={store as TooltipRootContext}>
      <IsolateChildren>
        <Show when={props.handle}>
          {(handle) => <PopupHandleAttachment handle={handle()} store={store} />}
        </Show>
        <TooltipInteractions
          store={store}
          enabled={shouldRenderInteractions()}
          disabled={disabled()}
          trackCursorAxis={trackCursorAxis()}
        />
        {resolveChildren()}
      </IsolateChildren>
    </TooltipRootContext>
  );
}

export interface TooltipRootState {}

export interface TooltipRootProps<Payload = unknown> {
  /**
   * Whether the tooltip is initially open.
   *
   * To render a controlled tooltip, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Whether the tooltip is currently open.
   */
  open?: boolean | undefined;
  /**
   * Event handler called when the tooltip is opened or closed.
   */
  onOpenChange?:
    ((open: boolean, eventDetails: TooltipRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Event handler called after any animations complete when the tooltip is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * Whether the tooltip contents can be hovered without closing the tooltip.
   * @default false
   */
  disableHoverablePopup?: boolean | undefined;
  /**
   * Determines which axis the tooltip should track the cursor on.
   * @default 'none'
   */
  trackCursorAxis?: 'none' | 'x' | 'y' | 'both' | undefined;
  /**
   * A ref to imperative actions.
   * - `unmount`: Unmounts the tooltip popup.
   * - `close`: Closes the tooltip imperatively when called.
   */
  actionsRef?: RefObject<TooltipRoot.Actions | null> | undefined;
  /**
   * Whether the tooltip is disabled.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A handle to associate the tooltip with a trigger.
   * If specified, allows external triggers to control the tooltip's open state.
   * Can be created with the Tooltip.createHandle() method.
   */
  handle?: TooltipHandle<Payload> | undefined;
  /**
   * The content of the tooltip.
   * This can be a regular node or a render function that receives the `payload` of the active trigger.
   */
  children?: JSX.Element | PayloadChildRenderFunction<Payload> | undefined;
  /**
   * ID of the trigger that the tooltip is associated with.
   * This is useful in conjunction with the `open` prop to create a controlled tooltip.
   * There's no need to specify this prop when the tooltip is uncontrolled (that is, when the `open` prop is not set).
   */
  triggerId?: string | null | undefined;
  /**
   * ID of the trigger that the tooltip is associated with.
   * This is useful in conjunction with the `defaultOpen` prop to create an initially open tooltip.
   */
  defaultTriggerId?: string | null | undefined;
}

export interface TooltipRootActions {
  unmount: () => void;
  close: () => void;
}

export type TooltipRootChangeEventReason =
  | typeof REASONS.triggerHover
  | typeof REASONS.triggerFocus
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.escapeKey
  | typeof REASONS.disabled
  | typeof REASONS.imperativeAction
  | typeof REASONS.none;

export type TooltipRootChangeEventDetails =
  BaseUIChangeEventDetails<TooltipRoot.ChangeEventReason> & {
    preventUnmountOnClose(): void;
  };

export namespace TooltipRoot {
  export type State = TooltipRootState;
  export type Props<Payload = unknown> = TooltipRootProps<Payload>;
  export type Actions = TooltipRootActions;
  export type ChangeEventReason = TooltipRootChangeEventReason;
  export type ChangeEventDetails = TooltipRootChangeEventDetails;
}

function TooltipInteractions<Payload>(props: {
  store: TooltipStore<Payload>;
  /**
   * Whether the interactions are active. The React version conditionally renders this
   * component instead; Solid keeps it mounted (so sibling children stay stable) and
   * gates the hooks and forwarded props.
   */
  enabled: boolean;
  disabled: boolean;
  trackCursorAxis: 'none' | 'x' | 'y' | 'both';
}): JSX.Element {
  const store = untrack(() => props.store);
  const floatingRootContext = store.state.floatingRootContext;

  const dismiss = useDismiss(floatingRootContext, {
    get enabled() {
      return props.enabled && !props.disabled;
    },
    referencePress: () => store.select('closeOnClick'),
  });
  const clientPoint = useClientPoint(floatingRootContext, {
    get enabled() {
      return props.enabled && !props.disabled && props.trackCursorAxis !== 'none';
    },
    get axis() {
      return props.trackCursorAxis === 'none' ? undefined : props.trackCursorAxis;
    },
  });

  // Both hooks return `trigger: reference` (same object identity), so the active and
  // inactive trigger props can never differ. `useClientPoint` has no floating-side props.
  // Memoized (like the React version's `useMemo`) so the synced store values keep a stable
  // identity between changes of the underlying hook outputs.
  const triggerProps = createMemo(() =>
    props.enabled ? mergeProps(clientPoint.reference, dismiss.reference) : EMPTY_OBJECT,
  );
  usePopupInteractionProps(store, {
    get activeTriggerProps() {
      return triggerProps();
    },
    get inactiveTriggerProps() {
      return triggerProps();
    },
    get popupProps() {
      return (props.enabled ? dismiss.floating : undefined) ?? EMPTY_OBJECT;
    },
  });

  return null;
}
