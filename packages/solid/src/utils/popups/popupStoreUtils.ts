import { createRenderEffect, flush, onCleanup, untrack, type Accessor } from 'solid-js';
import { EMPTY_OBJECT } from '@base-ui/utils/empty';
import type { InteractionType } from '@base-ui/utils/useEnhancedClickHandler';
import type { JSX } from '@solidjs/web';
import { FOCUSABLE_ATTRIBUTE } from '../../floating-ui-react/utils/constants';
import { useFloatingParentNodeId } from '../../floating-ui-react/components/FloatingTree';
import {
  useSyncedFloatingRootContext,
  type SyncedFloatingRootContextStore,
} from '../../floating-ui-react/hooks/useSyncedFloatingRootContext';
import { useTransitionStatus } from '../../internals/useTransitionStatus';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useBaseUiId } from '../../internals/useBaseUiId';
import type { HTMLProps } from '../../internals/types';
import {
  createChangeEventDetails,
  type BaseUIChangeEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { Store } from '../../solid-utils/store';
import type { RefObject } from '../../solid-utils/refs';
import {
  PopupStoreState,
  PopupStoreContext,
  popupStoreSelectors,
  PopupTriggerDataStore,
} from './store';

export const FOCUSABLE_POPUP_PROPS = {
  tabindex: -1,
  [FOCUSABLE_ATTRIBUTE]: '',
} satisfies HTMLProps<HTMLElement> & Record<typeof FOCUSABLE_ATTRIBUTE, string>;

/**
 * Returns the default `initialFocus` resolver for a popup. When opened by touch it focuses the
 * popup element itself to prevent the virtual keyboard from opening (required for Android
 * specifically; iOS handles this automatically). Otherwise it falls back to the default behavior.
 */
export function createDefaultInitialFocus(popupRef: RefObject<HTMLElement>) {
  return (interactionType: InteractionType) =>
    interactionType === 'touch' ? popupRef.current : true;
}

type PopupStoreWithOpen<
  State extends PopupStoreState<unknown>,
  SetOpenEventDetails extends BaseUIChangeEventDetails<string>,
> = PopupTriggerDataStore<State> &
  Pick<SyncedFloatingRootContextStore<State>, 'useSyncedValue'> & {
    setOpen(open: boolean, eventDetails: SetOpenEventDetails): void;
  };

/**
 * The subset of a popup handle that a Root needs to bind its store to. Both the real handle classes
 * and any test double satisfy it.
 */
export interface PopupRootStoreHandle<Store> {
  attachStore(store: Store): () => void;
}

/**
 * Creates and owns a popup store on behalf of a Root part. The store is created exactly once, with
 * controlled props and root state synced separately after creation. Sets up the synced floating
 * root context and returns the store.
 *
 * @param createStore Factory that builds the store. Called exactly once, receiving the floating id
 * and whether the popup is nested inside another floating element, both resolved on setup.
 * @param treatPopupAsFloatingElement Whether the popup element is passed to Floating UI as the
 * floating element instead of the default positioner.
 */
export function usePopupRootStore<
  State extends PopupStoreState<unknown>,
  SetOpenEventDetails extends BaseUIChangeEventDetails<string>,
  StoreType extends PopupStoreWithOpen<State, SetOpenEventDetails> &
    SyncedFloatingRootContextStore<State>,
>(
  createStore: (floatingId: string | undefined, nested: boolean) => StoreType,
  treatPopupAsFloatingElement = false,
): StoreType {
  const floatingId = useBaseUiId();
  const nested = useFloatingParentNodeId() != null;

  const store = untrack(() => createStore(untrack(floatingId), nested));

  useSyncedFloatingRootContext({
    popupStore: store,
    treatPopupAsFloatingElement,
    floatingRootContext: store.state.floatingRootContext,
    floatingId,
    nested,
    onOpenChange: store.setOpen,
  });

  return store;
}

/**
 * Attaches a Root's store to a handle for this component's mounted lifetime. Popup Roots render
 * it before their interactions and user children so its render effect runs before descendant
 * effects, letting descendants call the handle during the Root's initial commit.
 *
 * Popup Roots must render this component only when a handle is present so handle-less Roots avoid
 * creating the extra effect.
 */
export function PopupHandleAttachment<StoreType>(props: {
  handle: PopupRootStoreHandle<StoreType>;
  store: StoreType;
}): JSX.Element {
  // Guarded manually per PORTING.md rule 20a: a render effect's apply phase may
  // re-run with an unchanged computed value, and re-attaching would churn the
  // handle's attachment stack.
  let detach: (() => void) | undefined;
  let lastAttached: { handle: PopupRootStoreHandle<StoreType>; store: StoreType } | undefined;

  createRenderEffect(
    () => ({ handle: props.handle, store: props.store }),
    (current) => {
      if (
        lastAttached &&
        lastAttached.handle === current.handle &&
        lastAttached.store === current.store
      ) {
        return;
      }
      lastAttached = current;
      detach?.();
      detach = current.handle.attachStore(current.store);
    },
  );

  void onCleanup(() => {
    detach?.();
    detach = undefined;
  });

  return null;
}

function syncTriggerCount(store: PopupTriggerDataStore<PopupStoreState<unknown>>) {
  const triggerCount = store.context.triggerElements.size;
  if (store.select('open') && store.state.triggerCount !== triggerCount) {
    store.set('triggerCount', triggerCount);
  }
}

/**
 * Returns a stable callback ref that registers/unregisters the trigger element in the store.
 *
 * Stable so a downstream ref merger that retains the callback it was first given still reaches the
 * trigger's current store. The registration is tracked as a `(store, id, element)` triple, so
 * unregistering targets the store the element was actually registered in.
 *
 * Since the callback never changes, the caller must re-run it from a render effect keyed on the
 * trigger id (and re-create the trigger scope when the store changes) to migrate an
 * already-registered element.
 *
 * @param id Accessor for the id of the trigger.
 * @param store The Store instance where the trigger should be registered.
 */
export function useTriggerRegistration<State extends PopupStoreState<unknown>>(
  id: Accessor<string | undefined>,
  store: PopupTriggerDataStore<State>,
) {
  let registration: {
    store: PopupTriggerDataStore<State>;
    id: string;
    element: Element;
  } | null = null;

  return (element: Element | null) => {
    const currentId = untrack(id);

    if (registration !== null) {
      if (
        registration.element === element &&
        registration.store === store &&
        registration.id === currentId
      ) {
        // Already registered where it belongs, so the caller's migration effect is free on mount.
        return;
      }

      const previousRegistration = registration;
      registration = null;
      const registeredStore = previousRegistration.store;
      if (
        registeredStore.context.triggerElements.getById(previousRegistration.id) ===
        previousRegistration.element
      ) {
        registeredStore.context.triggerElements.delete(previousRegistration.id);
        syncTriggerCount(registeredStore);
      }
    }

    if (element !== null && currentId !== undefined) {
      registration = { store, id: currentId, element };
      store.context.triggerElements.add(currentId, element);
      syncTriggerCount(store);
    }
  };
}

type PopupOpenState = Pick<
  PopupStoreState<unknown>,
  'open' | 'preventUnmountingOnClose' | 'activeTriggerId' | 'activeTriggerElement'
>;

export function createPopupOpenState(
  state: PopupOpenState,
  open: boolean,
  trigger: Element | undefined,
  preventUnmountOnClose = false,
): PopupOpenState {
  let preventUnmountingOnClose = state.preventUnmountingOnClose;
  if (open) {
    // Opening starts a new close cycle, so clear any previous request to keep the popup mounted.
    preventUnmountingOnClose = false;
  } else if (preventUnmountOnClose) {
    preventUnmountingOnClose = true;
  }

  const triggerId = trigger?.id ?? null;
  let activeTriggerId = state.activeTriggerId;
  let activeTriggerElement = state.activeTriggerElement;

  // If a popup is closing, the `trigger` may be undefined.
  // We want to keep the previous value so that exit animations are played and focus is returned correctly.
  if (triggerId || open) {
    activeTriggerId = triggerId;
    activeTriggerElement = trigger ?? null;
  }

  return {
    open,
    preventUnmountingOnClose,
    activeTriggerId,
    activeTriggerElement,
  };
}

export function attachPreventUnmountOnClose(eventDetails: { preventUnmountOnClose(): void }) {
  let preventUnmountOnClose = false;

  eventDetails.preventUnmountOnClose = () => {
    preventUnmountOnClose = true;
  };

  return () => preventUnmountOnClose;
}

/**
 * Runs the shared open-change sequence for a popup store: notifies `onOpenChange`,
 * honors cancellation, dispatches the floating root change, maps the reason to an
 * `instantType`, and commits the state update (synchronously for hover so
 * `getAnimations()` observes it). Stores supply their own differences via
 * `extraState` (e.g. the last change reason) and `onBeforeDispatch` (e.g. updating
 * inline-rect coordinates).
 */
export function applyPopupOpenChange<
  State extends PopupStoreState<unknown> & {
    instantType?: 'delay' | 'dismiss' | 'focus' | undefined;
  },
  EventDetails extends BaseUIChangeEventDetails<string>,
  ExtraKey extends keyof State = never,
>(
  store: {
    readonly context: Pick<PopupStoreContext<EventDetails>, 'onOpenChange'>;
    readonly state: State;
    update<const Key extends keyof State>(state: Pick<State, Key>): void;
  },
  nextOpen: boolean,
  eventDetails: EventDetails & { preventUnmountOnClose(): void },
  options: {
    onBeforeDispatch?: (() => void) | undefined;
    extraState?: Pick<State, ExtraKey> | undefined;
  } = {},
): void {
  const reason = eventDetails.reason;
  const isHover = reason === REASONS.triggerHover;
  const isFocusOpen = nextOpen && reason === REASONS.triggerFocus;
  const isDismissClose =
    !nextOpen && (reason === REASONS.triggerPress || reason === REASONS.escapeKey);

  const shouldPreventUnmountOnClose = attachPreventUnmountOnClose(eventDetails);

  store.context.onOpenChange?.(nextOpen, eventDetails);

  if (eventDetails.isCanceled) {
    return;
  }

  options.onBeforeDispatch?.();

  store.state.floatingRootContext.dispatchOpenChange(nextOpen, eventDetails);

  const changeState = () => {
    const popupOpenState = createPopupOpenState(
      store.state,
      nextOpen,
      eventDetails.trigger,
      shouldPreventUnmountOnClose(),
    );

    const updatedState = { ...options.extraState, ...popupOpenState } as Pick<
      State,
      keyof PopupOpenState | ExtraKey | 'instantType'
    >;

    if (isFocusOpen) {
      updatedState.instantType = 'focus';
    } else if (isDismissClose) {
      updatedState.instantType = 'dismiss';
    } else if (isHover) {
      updatedState.instantType = undefined;
    }

    store.update(updatedState);
  };

  changeState();

  if (isHover) {
    // Flush synchronously for hover so `node.getAnimations()` sees the new state
    // (the Solid equivalent of React's `flushSync`).
    flush();
  }
}

/**
 * Sets up trigger data forwarding to the store.
 *
 * @param triggerId Accessor for the id of the trigger.
 * @param triggerElementRef Ref for the trigger DOM element.
 * @param store The Store instance managing the popup state.
 * @param stateUpdates An object (with getters for reactive fields) with state updates to apply
 * when the trigger is active.
 */
export function useTriggerDataForwarding<
  State extends PopupStoreState<unknown>,
  const Key extends keyof Omit<State, 'activeTriggerId' | 'activeTriggerElement'>,
>(
  triggerId: Accessor<string | undefined>,
  triggerElementRef: RefObject<Element>,
  store: PopupTriggerDataStore<State>,
  stateUpdates: Pick<State, Key>,
) {
  const isMountedByThisTrigger = store.useState('isMountedByTrigger', triggerId);

  const baseRegisterTrigger = useTriggerRegistration(triggerId, store);

  const stateUpdateKeys = Object.keys(stateUpdates) as Key[];
  const readStateUpdates = () => {
    const snapshot = {} as Pick<State, Key>;
    for (const key of stateUpdateKeys) {
      snapshot[key] = stateUpdates[key];
    }
    return snapshot;
  };

  // Applies trigger-owned state (active-trigger ownership and payload) when the trigger registers.
  // It reads the latest values when invoked.
  const applyTriggerData = (element: Element) => {
    const open = store.select('open');
    const activeTriggerId = store.select('activeTriggerId');
    const currentTriggerId = untrack(triggerId);

    if (activeTriggerId === currentTriggerId) {
      const changes = {
        activeTriggerElement: element,
        ...(open ? untrack(readStateUpdates) : null),
      } as Pick<Readonly<State>, Key | 'activeTriggerElement'>;
      store.update(changes);
      return;
    }

    if (activeTriggerId == null && open) {
      // If a popup is already open, a detached trigger can mount before any active trigger
      // has been established. Claim the first registered trigger so trigger-owned focus
      // management and ARIA relationships work.
      const changes = {
        activeTriggerId: currentTriggerId ?? null,
        activeTriggerElement: element,
        ...untrack(readStateUpdates),
      } as Pick<Readonly<State>, Key | 'activeTriggerId' | 'activeTriggerElement'>;
      store.update(changes);
    }
  };

  // Stable, so the merged ref on the rendered element keeps its identity for the trigger's whole
  // lifetime.
  const registerTrigger = (element: Element | null) => {
    baseRegisterTrigger(element);
    if (element) {
      applyTriggerData(element);
    }
  };

  // The ref does not re-fire on an id change, so migrate here instead: unregister the previous
  // registration, then register the element the trigger still renders under the current id.
  createRenderEffect(
    () => triggerId(),
    () => {
      registerTrigger(triggerElementRef.current);
    },
  );
  void onCleanup(() => registerTrigger(null));

  createRenderEffect(
    () => ({ mountedByThis: isMountedByThisTrigger(), updates: readStateUpdates() }),
    (current) => {
      if (current.mountedByThis) {
        const changes = {
          activeTriggerElement: triggerElementRef.current,
          ...current.updates,
        } as Pick<Readonly<State>, Key | 'activeTriggerElement'>;
        store.update(changes);
      }
    },
  );

  return { registerTrigger, isMountedByThisTrigger };
}

export type PayloadChildRenderFunction<Payload> = (arg: {
  payload: Payload | undefined;
}) => JSX.Element;

/**
 * Keeps trigger registration state synchronized while the popup is open.
 *
 * When a popup opens without an explicit trigger id and exactly one trigger is registered, that
 * trigger is claimed as the active trigger. When the active trigger id is still registered but its
 * element changed, the active element is refreshed. When the active trigger id is missing from the
 * registry but the same element is still registered under a different id (e.g. the rendered trigger
 * carries its own DOM `id` that differs from Base UI's internal trigger id), the active id is
 * reassociated to the registered id instead of being treated as lost. When the active trigger
 * unregisters, the default path preserves existing ownership so non-closing popup families do not
 * silently claim a different trigger while staying open.
 *
 * If `closeOnActiveTriggerUnmount` is enabled, unregistering a previously resolved active trigger
 * requests a close after a microtask so a same-tick replacement trigger with the same id can
 * register first. An active trigger id that has not matched a registered trigger yet is treated as
 * pending and does not request a close.
 *
 * This should be called on the Root part.
 *
 * @param store The Store instance managing the popup state.
 * @param options Options for active trigger unmount behavior.
 */
export function useImplicitActiveTrigger<State extends PopupStoreState<unknown>>(
  store: PopupStoreWithOpen<State, BaseUIChangeEventDetails<typeof REASONS.none>>,
  options: {
    closeOnActiveTriggerUnmount?: boolean | undefined;
  } = {},
) {
  // Distinguishes a trigger that unmounted from a new active trigger that has not hydrated yet.
  let resolvedActiveTriggerId: string | null = null;
  const open = store.useState('open');
  const reactiveTriggerCount = store.useState('triggerCount');
  // Subscribe to the active trigger id so the reconciliation below reruns when ownership moves to
  // another trigger while the popup stays open (e.g. a focus/hover handoff between triggers).
  const activeTriggerId = store.useState('activeTriggerId');
  // Subscribe to the active trigger element so the reconciliation reruns when a pending active
  // trigger registers while the trigger count nets out unchanged (registration forwards the
  // element to the store when the registering trigger matches the active id). Without this, the
  // id would never be marked resolved and a later genuine unmount would be misclassified as
  // pending, disabling `closeOnActiveTriggerUnmount`.
  const reactiveActiveTriggerElement = store.useState('activeTriggerElement');

  createRenderEffect(
    () => ({
      open: open(),
      triggerCount: reactiveTriggerCount(),
      activeTriggerId: activeTriggerId(),
      activeTriggerElement: reactiveActiveTriggerElement(),
      closeOnActiveTriggerUnmount: options.closeOnActiveTriggerUnmount ?? false,
    }),
    (current) => {
      const { closeOnActiveTriggerUnmount } = current;

      if (!current.open) {
        resolvedActiveTriggerId = null;
        if (store.state.triggerCount !== 0) {
          store.set('triggerCount', 0);
        }
        return;
      }

      const triggerCount = store.context.triggerElements.size;
      const stateUpdates = {} as Pick<
        State,
        'triggerCount' | 'activeTriggerId' | 'activeTriggerElement'
      >;

      if (store.state.triggerCount !== triggerCount) {
        stateUpdates.triggerCount = triggerCount;
      }

      const currentActiveTriggerId = store.select('activeTriggerId');
      let lostActiveTriggerId: string | null = null;

      if (currentActiveTriggerId) {
        const activeTriggerElement = store.context.triggerElements.getById(currentActiveTriggerId);
        if (!activeTriggerElement) {
          for (const [triggerId, triggerElement] of store.context.triggerElements.entries()) {
            if (triggerElement === store.state.activeTriggerElement) {
              stateUpdates.activeTriggerId = triggerId;
              stateUpdates.activeTriggerElement = triggerElement;
              resolvedActiveTriggerId = triggerId;
              break;
            }
          }

          if (stateUpdates.activeTriggerId === undefined) {
            if (resolvedActiveTriggerId === currentActiveTriggerId) {
              lostActiveTriggerId = currentActiveTriggerId;
            } else {
              resolvedActiveTriggerId = null;
            }
          }
        } else {
          resolvedActiveTriggerId = currentActiveTriggerId;
          if (activeTriggerElement !== store.state.activeTriggerElement) {
            stateUpdates.activeTriggerElement = activeTriggerElement;
          }
        }
      } else {
        resolvedActiveTriggerId = null;
      }

      if (!lostActiveTriggerId && !currentActiveTriggerId && triggerCount === 1) {
        const iteratorResult = store.context.triggerElements.entries().next();
        if (!iteratorResult.done) {
          const [implicitTriggerId, implicitTriggerElement] = iteratorResult.value;
          stateUpdates.activeTriggerId = implicitTriggerId;
          stateUpdates.activeTriggerElement = implicitTriggerElement;
          resolvedActiveTriggerId = implicitTriggerId;
        }
      }

      if (
        stateUpdates.triggerCount !== undefined ||
        stateUpdates.activeTriggerId !== undefined ||
        stateUpdates.activeTriggerElement !== undefined
      ) {
        store.update(stateUpdates);
      }

      if (lostActiveTriggerId) {
        if (closeOnActiveTriggerUnmount) {
          // Defer so a same-tick replacement trigger with the same id can register first.
          queueMicrotask(() => {
            if (
              store.select('open') &&
              store.select('activeTriggerId') === lostActiveTriggerId &&
              !store.context.triggerElements.getById(lostActiveTriggerId)
            ) {
              const eventDetails = createChangeEventDetails(REASONS.none);
              store.setOpen(false, eventDetails);
              // If closing is canceled, keep the previous active trigger ownership for the
              // still-open popup instead of claiming another trigger implicitly.
              if (!eventDetails.isCanceled) {
                store.update({
                  activeTriggerId: null,
                  activeTriggerElement: null,
                } as Pick<State, 'activeTriggerId' | 'activeTriggerElement'>);
              }
            }
          });
        }
      }
    },
  );
}

/**
 * Manages the mounted state of the popup.
 * Sets up the transition status listeners and handles unmounting when needed.
 * Updates the `mounted`, `transitionStatus`, and `preventUnmountingOnClose` states in the store.
 *
 * @param open Accessor for whether the popup is open.
 * @param store The Store instance managing the popup state.
 * @param onUnmount Optional callback to be called when the popup is unmounted.
 * @param animateInitialOpen Whether a popup that mounts already open should still play its enter
 *   transition. Defaults to `false`, so content that was open on the first render (a `defaultOpen`
 *   popup on page load, SSR'd markup) appears without animating. Opt in for popups whose subtree
 *   only mounts in response to something the user did, such as a submenu inside a menu popup.
 *
 * @returns A function to forcibly unmount the popup.
 */
export function useOpenStateTransitions<State extends PopupStoreState<unknown>>(
  open: Accessor<boolean>,
  store: Store<Readonly<State>, PopupStoreContext<never>, typeof popupStoreSelectors>,
  onUnmount?: () => void,
  animateInitialOpen?: boolean,
) {
  const { mounted, setMounted, transitionStatus } = useTransitionStatus(
    open,
    false,
    false,
    animateInitialOpen ?? false,
  );
  const preventUnmountingOnClose = store.useState('preventUnmountingOnClose');
  // Opening starts a new close cycle. Computed so the close-completion hook below
  // reads the synchronized value in the same pass.
  const syncedPreventUnmountingOnClose = () => (open() ? false : preventUnmountingOnClose());

  store.useSyncedValues({
    get mounted() {
      return mounted();
    },
    get transitionStatus() {
      return transitionStatus();
    },
    get preventUnmountingOnClose() {
      return syncedPreventUnmountingOnClose();
    },
  } as Pick<Readonly<State>, 'mounted' | 'transitionStatus' | 'preventUnmountingOnClose'>);

  const forceUnmount = () => {
    setMounted(false);
    store.update({
      activeTriggerId: null,
      activeTriggerElement: null,
      mounted: false,
      preventUnmountingOnClose: false,
    } as Pick<
      Readonly<State>,
      'activeTriggerId' | 'activeTriggerElement' | 'mounted' | 'preventUnmountingOnClose'
    >);
    onUnmount?.();
    store.context.onOpenChangeComplete?.(false);
  };

  useOpenChangeComplete({
    get enabled() {
      return mounted() && !open() && !syncedPreventUnmountingOnClose();
    },
    get open() {
      return open();
    },
    ref: store.context.popupRef,
    onComplete() {
      if (!untrack(open)) {
        forceUnmount();
      }
    },
  });

  return { forceUnmount, transitionStatus };
}

type PopupInteractionPropKey = 'activeTriggerProps' | 'inactiveTriggerProps' | 'popupProps';

export function usePopupInteractionProps<
  State extends PopupStoreState<unknown>,
  const Key extends keyof State,
>(
  store: Store<Readonly<State>, PopupStoreContext<never>, typeof popupStoreSelectors>,
  statePart: Pick<State, Key | PopupInteractionPropKey>,
) {
  store.useSyncedValues(statePart as Pick<Readonly<State>, Key | PopupInteractionPropKey>);

  void onCleanup(() => {
    store.update({
      activeTriggerProps: EMPTY_OBJECT,
      inactiveTriggerProps: EMPTY_OBJECT,
      popupProps: EMPTY_OBJECT,
    } as Pick<Readonly<State>, PopupInteractionPropKey>);
  });
}

export function usePopupRootSync<
  State extends PopupStoreState<unknown> & {
    openMethod: InteractionType | null;
  },
>(
  store: Store<Readonly<State>, PopupStoreContext<never>, typeof popupStoreSelectors>,
  open: Accessor<boolean>,
) {
  createRenderEffect(open, (isOpen) => {
    if (!isOpen && store.state.openMethod !== null) {
      store.set('openMethod', null as State['openMethod']);
    }
  });

  void onCleanup(() => {
    if (store.state.openMethod !== null) {
      store.set('openMethod', null as State['openMethod']);
    }
  });
}
