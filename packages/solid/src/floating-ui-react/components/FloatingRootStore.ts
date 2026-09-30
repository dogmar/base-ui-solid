import { createMemo, createRenderEffect, createSignal, getOwner, type Accessor } from 'solid-js';
import type { FloatingEvents, ContextData, ReferenceType } from '../types';
import { type BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { createEventEmitter } from '../utils/createEventEmitter';
import { type FloatingUIOpenChangeDetails } from '../../internals/types';
import { type PopupTriggerMap } from '../../utils/popups';
import { isClickLikeEvent } from '../utils';
import type { TransitionStatus } from '../../internals/useTransitionStatus';

export interface FloatingRootState {
  open: boolean;
  transitionStatus: TransitionStatus | undefined;
  domReferenceElement: Element | null;
  referenceElement: ReferenceType | null;
  floatingElement: HTMLElement | null;
  positionReference: ReferenceType | null;
  /**
   * The ID of the floating element.
   */
  floatingId: string | undefined;
}

export interface FloatingRootStoreContext {
  onOpenChange:
    | ((open: boolean, eventDetails: BaseUIChangeEventDetails<string>) => void)
    | undefined;
  readonly dataRef: { current: ContextData };
  readonly events: FloatingEvents;
  nested: boolean;
  readonly triggerElements: PopupTriggerMap;
}

const selectors = {
  open: (state: FloatingRootState) => state.open,
  transitionStatus: (state: FloatingRootState) => state.transitionStatus,
  domReferenceElement: (state: FloatingRootState) => state.domReferenceElement,
  referenceElement: (state: FloatingRootState) => state.positionReference ?? state.referenceElement,
  floatingElement: (state: FloatingRootState) => state.floatingElement,
  floatingId: (state: FloatingRootState) => state.floatingId,
};

type Selectors = typeof selectors;

interface FloatingRootStoreOptions {
  open: boolean;
  transitionStatus: TransitionStatus | undefined;
  referenceElement: ReferenceType | null;
  floatingElement: HTMLElement | null;
  triggerElements: PopupTriggerMap;
  floatingId: string | undefined;
  /**
   * When true, `setOpen` only forwards to `onOpenChange`.
   * The popup store owns `dispatchOpenChange(...)` in this mode.
   */
  syncOnly: boolean;
  nested: boolean;
  onOpenChange:
    | ((open: boolean, eventDetails: BaseUIChangeEventDetails<string>) => void)
    | undefined;
}

/**
 * Solid port of the React `FloatingRootStore` (a `ReactStore` subclass).
 *
 * Semantics preserved from React:
 * - `state` is the synchronous source of truth: reads always return the value
 *   written by the latest `set`/`update`, without subscribing.
 * - `useState(key)` returns an **accessor** subscribed to the store's reactive
 *   channel; like all Solid signals, it reflects writes after the next flush.
 * - `context` holds non-reactive values (callbacks, refs, the event emitter).
 */
export class FloatingRootStore {
  /**
   * Non-reactive values such as refs, callbacks, etc.
   */
  readonly context: FloatingRootStoreContext;

  private readonly syncOnly: boolean;

  /**
   * The current state, updated synchronously by `set`/`update`. Reading it does
   * not subscribe; use `useState(key)` for reactive reads.
   */
  private currentState: Readonly<FloatingRootState>;

  private readonly trackedState: Accessor<Readonly<FloatingRootState>>;

  private readonly writeTrackedState: (state: Readonly<FloatingRootState>) => void;

  constructor(options: FloatingRootStoreOptions) {
    const { syncOnly, nested, onOpenChange, triggerElements, ...initialState } = options;

    this.currentState = {
      ...initialState,
      positionReference: initialState.referenceElement,
      domReferenceElement: initialState.referenceElement as Element | null,
    };

    const [trackedState, setTrackedState] = createSignal<Readonly<FloatingRootState>>(
      this.currentState,
      { ownedWrite: true },
    );
    this.trackedState = trackedState;
    this.writeTrackedState = setTrackedState;

    this.context = {
      onOpenChange,
      dataRef: { current: {} },
      events: createEventEmitter(),
      nested,
      triggerElements,
    };

    this.syncOnly = syncOnly;
  }

  get state(): Readonly<FloatingRootState> {
    return this.currentState;
  }

  /**
   * Replaces the entire state and notifies reactive subscribers.
   */
  setState(newState: Readonly<FloatingRootState>) {
    if (this.currentState === newState) {
      return;
    }
    this.currentState = newState;
    this.writeTrackedState(newState);
  }

  /**
   * Merges the provided changes into the current state and notifies reactive
   * subscribers if there are changes.
   */
  update<const Key extends keyof FloatingRootState>(changes: Pick<FloatingRootState, Key>) {
    for (const key in changes) {
      if (!Object.is(this.currentState[key as Key], changes[key as Key])) {
        this.setState({ ...this.currentState, ...changes });
        return;
      }
    }
  }

  /**
   * Sets a specific key in the store's state to a new value and notifies
   * reactive subscribers if the value has changed.
   */
  set<Key extends keyof FloatingRootState>(key: Key, value: FloatingRootState[Key]) {
    if (!Object.is(this.currentState[key], value)) {
      this.setState({ ...this.currentState, [key]: value });
    }
  }

  /**
   * Returns an accessor for the given selector, subscribed to the store.
   * Solid equivalent of the React `ReactStore.useState(key)`.
   */
  useState<Key extends keyof Selectors>(key: Key): Accessor<ReturnType<Selectors[Key]>> {
    const selector = selectors[key];
    const read = () => selector(this.trackedState()) as ReturnType<Selectors[Key]>;
    // Selector-level memoization: without it every reader invalidates on every
    // store write, and effects that read the store while syncing derived
    // objects back into it oscillate. Falls back to a plain accessor when
    // called without an owner.
    return getOwner() ? createMemo(read) : read;
  }

  /**
   * Gets the current value from the store using a selector with the provided
   * key, without subscribing.
   */
  select<Key extends keyof Selectors>(key: Key): ReturnType<Selectors[Key]> {
    return selectors[key](this.currentState) as ReturnType<Selectors[Key]>;
  }

  /**
   * Synchronizes a single external reactive value into the store.
   * Solid equivalent of the React `ReactStore.useSyncedValue`: the value
   * accessor is tracked and the store is updated whenever it changes.
   */
  useSyncedValue<Key extends keyof FloatingRootState>(
    key: Key,
    value: Accessor<FloatingRootState[Key]>,
  ) {
    // eslint-disable-next-line consistent-this
    const store = this;
    createRenderEffect(value, (next) => {
      if (store.currentState[key] !== next) {
        store.set(key, next);
      }
    });
  }

  /**
   * Syncs the event used by hover logic to distinguish hover-open from click-like interaction.
   */
  syncOpenEvent = (newOpen: boolean, event: Event | undefined) => {
    if (
      !newOpen ||
      !this.state.open ||
      // Prevent a pending hover-open from overwriting a click-open event, while allowing
      // click events to upgrade a hover-open.
      (event != null && isClickLikeEvent(event))
    ) {
      this.context.dataRef.current.openEvent = newOpen ? event : undefined;
    }
  };

  /**
   * Runs the root-owned side effects for an open state change.
   */
  dispatchOpenChange = (newOpen: boolean, eventDetails: BaseUIChangeEventDetails<string>) => {
    this.syncOpenEvent(newOpen, eventDetails.event);

    const details: FloatingUIOpenChangeDetails = {
      open: newOpen,
      reason: eventDetails.reason,
      nativeEvent: eventDetails.event,
      nested: this.context.nested,
      triggerElement: eventDetails.trigger,
    };

    this.context.events.emit('openchange', details);
  };

  /**
   * Emits the `openchange` event through the internal event emitter and calls the `onOpenChange` handler with the provided arguments.
   *
   * @param newOpen The new open state.
   * @param eventDetails Details about the event that triggered the open state change.
   */
  setOpen = (newOpen: boolean, eventDetails: BaseUIChangeEventDetails<string>) => {
    if (this.syncOnly) {
      this.context.onOpenChange?.(newOpen, eventDetails);
      return;
    }

    this.dispatchOpenChange(newOpen, eventDetails);

    this.context.onOpenChange?.(newOpen, eventDetails);
  };
}
