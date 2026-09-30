/**
 * Solid port of `Store`/`ReactStore` from `@base-ui/utils/store`.
 *
 * The two React classes are merged into a single `Store` class here:
 * - `state` is the synchronous source of truth: reads always return the value
 *   written by the latest `setState`/`set`/`update`, without subscribing.
 * - `useState(key, ...args)` returns an **accessor** subscribed to the store's
 *   reactive channel; like all Solid signals, it reflects writes after the
 *   next flush. It accepts either a selector key or a plain state key.
 * - The `useXxx` methods keep their React names but take accessors for
 *   reactive inputs and register Solid effects, so they must be called during
 *   component setup (inside an owner).
 */
import { createMemo, createRenderEffect, createSignal, onCleanup, type Accessor } from 'solid-js';
import { NOOP } from '@base-ui/utils/empty';

export type SelectorFunction<State> = (state: State, ...args: any[]) => any;

type Listener<T> = (state: T) => void;

type MaybeCallable = (...args: any[]) => any;

type ContextFunctionKeys<Context> = {
  [Key in keyof Context]-?: Extract<Context[Key], MaybeCallable> extends never ? never : Key;
}[keyof Context];

type ContextFunction<Context, Key extends keyof Context> = Extract<Context[Key], MaybeCallable>;

type KeysAllowingUndefined<State> = {
  [Key in keyof State]-?: undefined extends State[Key] ? Key : never;
}[keyof State];

type ObserveSelector<State> = (state: State) => any;

type Tail<T extends readonly any[]> = T extends readonly [any, ...infer Rest] ? Rest : [];

type AccessorizedTuple<T extends readonly any[]> = {
  [Index in keyof T]: T[Index] | Accessor<T[Index]>;
};

type SelectorArgs<Selector> = Selector extends (...params: infer Params) => any
  ? AccessorizedTuple<Tail<Params>>
  : never;

function resolveArg(arg: unknown): unknown {
  return typeof arg === 'function' ? (arg as Accessor<unknown>)() : arg;
}

/**
 * A data store that supports synchronous reads, reactive (signal-backed)
 * subscriptions, controlled state keys, and non-reactive context values.
 */
export class Store<
  State extends object,
  Context = Record<string, never>,
  Selectors extends Record<string, SelectorFunction<State>> = Record<string, never>,
> {
  /**
   * Non-reactive values such as refs, callbacks, etc.
   */
  readonly context: Context;

  private selectors: Selectors | undefined;

  /**
   * The current state, updated synchronously by `setState`/`set`/`update`.
   * Reading it does not subscribe; use `useState(key)` for reactive reads.
   */
  private currentState: State;

  private readonly trackedState: Accessor<State>;

  private readonly writeTrackedState: (state: State) => void;

  private listeners: Set<Listener<State>>;

  // Internal state to handle recursive `setState()` calls
  private updateTick: number;

  constructor(state: State, context: Context = {} as Context, selectors?: Selectors) {
    this.currentState = state;
    this.context = context;
    this.selectors = selectors;
    this.listeners = new Set();
    this.updateTick = 0;

    const [trackedState, setTrackedState] = createSignal(state as Exclude<State, Function>, {
      ownedWrite: true,
    });
    this.trackedState = trackedState as Accessor<State>;
    this.writeTrackedState = setTrackedState as unknown as (next: State) => void;
  }

  get state(): State {
    return this.currentState;
  }

  /**
   * Registers a listener that will be called whenever the store's state changes.
   * Returns a function to unsubscribe the listener.
   */
  subscribe = (fn: Listener<State>) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  /**
   * Returns the current state of the store.
   */
  getSnapshot = () => {
    return this.currentState;
  };

  /**
   * Updates the entire store's state and notifies all subscribers.
   */
  setState(newState: State) {
    if (this.currentState === newState) {
      return;
    }
    this.currentState = newState;
    this.writeTrackedState(newState);
    this.updateTick += 1;

    const currentTick = this.updateTick;
    for (const listener of this.listeners) {
      if (currentTick !== this.updateTick) {
        // If the tick has changed, a recursive `setState` call has been made,
        // and it has already notified all listeners.
        return;
      }
      listener(newState);
    }
  }

  /**
   * Merges the provided changes into the current state and notifies
   * subscribers if there are changes.
   */
  update<const Key extends keyof State>(changes: Pick<State, Key>) {
    for (const key in changes) {
      if (!Object.is(this.currentState[key as Key], changes[key as Key])) {
        this.setState({ ...this.currentState, ...changes });
        return;
      }
    }
  }

  /**
   * Sets a specific key in the store's state to a new value and notifies
   * subscribers if the value has changed.
   */
  set<Key extends keyof State>(key: Key, value: State[Key]) {
    if (!Object.is(this.currentState[key], value)) {
      this.setState({ ...this.currentState, [key]: value });
    }
  }

  /**
   * Gives the state a new reference and updates all subscribers.
   */
  notifyAll() {
    this.setState({ ...this.currentState });
  }

  /**
   * Gets the current value from the store using a selector with the provided
   * key, without subscribing. Extra selector arguments are plain values.
   */
  select<Key extends keyof Selectors>(
    key: Key,
    ...args: Tail<Parameters<Selectors[Key]>>
  ): ReturnType<Selectors[Key]>;

  select(key: any, ...args: any[]): any {
    const selector = this.selectors![key as keyof Selectors];
    return selector(this.currentState, ...args);
  }

  /**
   * Returns an accessor subscribed to the store's reactive channel.
   * Solid equivalent of the React `ReactStore.useState(key)`.
   *
   * The key may name a selector or a plain state field (selectors take
   * priority). Extra selector arguments may be plain values or accessors;
   * accessors are resolved on each read, keeping the result reactive.
   */
  useState<Key extends keyof Selectors>(
    key: Key,
    ...args: SelectorArgs<Selectors[Key]>
  ): Accessor<ReturnType<Selectors[Key]>>;

  useState<Key extends keyof State>(key: Key): Accessor<State[Key]>;

  useState(key: any, ...args: any[]): any {
    const selector = this.selectors?.[key as keyof Selectors];
    // Memoized so downstream computations are only invalidated when the
    // *selected value* changes, not on every store write — the Solid
    // equivalent of `useStore`'s selector equality check in React (without
    // it, effects that both read and write the store through fresh object
    // identities would oscillate).
    if (selector) {
      return createMemo(() => selector(this.trackedState(), ...args.map(resolveArg)));
    }
    return createMemo(() => this.trackedState()[key as keyof State]);
  }

  /**
   * Synchronizes a single external reactive value into the store.
   * The accessor is tracked and the store is updated whenever it changes.
   */
  useSyncedValue<Key extends keyof State>(key: Key, value: Accessor<State[Key]>) {
    // eslint-disable-next-line consistent-this
    const store = this;
    createRenderEffect(value, (next) => {
      if (!Object.is(store.currentState[key], next)) {
        store.set(key, next);
      }
    });
  }

  /**
   * Synchronizes a single external reactive value into the store and cleans it
   * up (sets to `undefined`) on disposal.
   */
  useSyncedValueWithCleanup<Key extends KeysAllowingUndefined<State>>(
    key: Key,
    value: Accessor<State[Key]>,
  ) {
    this.useSyncedValue(key, value);
    void onCleanup(() => {
      this.set(key, undefined as State[Key]);
    });
  }

  /**
   * Synchronizes multiple external values into the store. `statePart` should
   * be an object whose reactive fields are getters; each getter is tracked and
   * the store updated whenever any of them changes. The set of keys must be
   * stable.
   */
  useSyncedValues<const Key extends keyof State>(statePart: Pick<State, Key>) {
    // eslint-disable-next-line consistent-this
    const store = this;
    const keys = Object.keys(statePart) as Key[];
    createRenderEffect(
      () => {
        const next = {} as Pick<State, Key>;
        for (const key of keys) {
          next[key] = statePart[key];
        }
        return next;
      },
      (next) => {
        store.update(next);
      },
    );
  }

  /**
   * Registers a controllable prop for a specific key. While the accessor
   * returns a non-undefined value, the store's state at `key` is kept in sync
   * with it.
   */
  useControlledProp<Key extends keyof State>(
    key: Key,
    controlled: Accessor<State[Key] | undefined>,
  ): void {
    // eslint-disable-next-line consistent-this
    const store = this;
    let previouslyControlled: boolean | undefined;

    createRenderEffect(controlled, (value) => {
      const isControlled = value !== undefined;

      if (isControlled && !Object.is(store.currentState[key], value)) {
        // Set the internal state to match the controlled value.
        store.setState({ ...store.currentState, [key]: value });
      }

      if (process.env.NODE_ENV !== 'production') {
        if (previouslyControlled === undefined) {
          previouslyControlled = isControlled;
        } else if (previouslyControlled !== isControlled) {
          console.error(
            `A component is changing the ${
              isControlled ? '' : 'un'
            }controlled state of ${key.toString()} to be ${isControlled ? 'un' : ''}controlled. Elements should not switch from uncontrolled to controlled (or vice versa).`,
          );
          previouslyControlled = isControlled;
        }
      }
    });
  }

  /**
   * Assigns a stable wrapper to the context that always calls the latest
   * function returned by the accessor (or a no-op when it returns undefined).
   */
  useContextCallback<Key extends ContextFunctionKeys<Context>>(
    key: Key,
    fn: Accessor<ContextFunction<Context, Key> | undefined>,
  ) {
    const stableFunction = ((...args: unknown[]) =>
      ((fn() as MaybeCallable | undefined) ?? NOOP)(...args)) as ContextFunction<Context, Key>;
    (this.context as Record<Key, ContextFunction<Context, Key>>)[key] = stableFunction;
  }

  /**
   * Returns a stable setter function for a specific key in the store's state.
   * Commonly used as a ref callback.
   */
  useStateSetter<const Key extends keyof State>(key: Key) {
    return (value: State[Key]) => {
      this.set(key, value);
    };
  }

  /**
   * Observes changes derived from the store's selectors (or an inline selector
   * function) and calls the listener when the selected value changes. The
   * listener is also called once immediately. Returns an unsubscribe function.
   */
  observe<Key extends keyof Selectors>(
    selector: Key,
    listener: (
      newValue: ReturnType<Selectors[Key]>,
      oldValue: ReturnType<Selectors[Key]>,
      store: this,
    ) => void,
  ): () => void;

  observe<Selector extends ObserveSelector<State>>(
    selector: Selector,
    listener: (newValue: ReturnType<Selector>, oldValue: ReturnType<Selector>, store: this) => void,
  ): () => void;

  observe(
    selector: keyof Selectors | ObserveSelector<State>,
    listener: (newValue: any, oldValue: any, store: this) => void,
  ) {
    let selectFn: ObserveSelector<State>;

    if (typeof selector === 'function') {
      selectFn = selector;
    } else {
      selectFn = this.selectors![selector] as ObserveSelector<State>;
    }

    let prevValue = selectFn(this.currentState);

    listener(prevValue, prevValue, this);

    return this.subscribe((nextState) => {
      const nextValue = selectFn(nextState);
      if (!Object.is(prevValue, nextValue)) {
        const oldValue = prevValue;
        prevValue = nextValue;
        listener(nextValue, oldValue, this);
      }
    });
  }
}

export type ReadonlyStore<State extends object> = Pick<
  Store<State>,
  'getSnapshot' | 'subscribe' | 'state'
>;
