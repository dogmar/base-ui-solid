import { createSignal, createEffect, untrack, type Accessor } from 'solid-js';
import { error } from '@base-ui/utils/error';

export interface UseControlledProps<T = unknown> {
  /**
   * Accessor for the component value when it's controlled.
   */
  controlled: Accessor<T | undefined>;
  /**
   * The default value when uncontrolled, and the fallback if a controlled value later becomes `undefined`.
   * Read once during initialization.
   */
  default: T | undefined;
  /**
   * The component name displayed in warnings.
   */
  name: string;
  /**
   * The name of the state variable displayed in warnings.
   */
  state?: string | undefined;
}

export type ControlledSetter<T> = (next: T | ((prev: T) => T)) => void;

/**
 * Solid port of `useControlled` from `@base-ui/utils`.
 *
 * The controlled/uncontrolled mode is fixed on the first read, matching the
 * React implementation. Returns a reactive accessor for the current value and
 * a setter that only takes effect in uncontrolled mode.
 *
 * The setter treats function arguments as updaters (React `setState`
 * semantics). When the stored value may itself be a function (arbitrary
 * user-supplied values), always commit via the updater form:
 * `setValue(() => newValue)`.
 */
export function useControlled<T = unknown>(
  props: Omit<UseControlledProps<T>, 'default'> & { default: T },
): [Accessor<T>, ControlledSetter<T>];
export function useControlled<T = unknown>(
  props: UseControlledProps<T>,
): [Accessor<T | undefined>, ControlledSetter<T | undefined>];
export function useControlled<T = unknown>({
  controlled,
  default: defaultProp,
  name,
  state = 'value',
}: UseControlledProps<T>): [Accessor<T | undefined>, ControlledSetter<T | undefined>] {
  const isControlled = untrack(controlled) !== undefined;
  // Base UI never stores function values in controlled state, so the initial
  // value can't be mistaken for a compute function.
  const [valueState, setValue] = createSignal<T | undefined>(
    defaultProp as Exclude<T, Function> | undefined,
    { ownedWrite: true },
  );

  const value: Accessor<T | undefined> = () => {
    if (isControlled) {
      const controlledValue = controlled();
      return controlledValue !== undefined ? controlledValue : untrack(valueState);
    }
    return valueState();
  };

  if (process.env.NODE_ENV !== 'production') {
    createEffect(
      () => controlled(),
      (controlledValue) => {
        if (isControlled !== (controlledValue !== undefined)) {
          error(
            [
              `A component is changing the ${
                isControlled ? '' : 'un'
              }controlled ${state} state of ${name} to be ${isControlled ? 'un' : ''}controlled.`,
              'Elements should not switch from uncontrolled to controlled (or vice versa).',
              `Decide between using a controlled or uncontrolled ${name} ` +
                'element for the lifetime of the component.',
              "The nature of the state is determined during the first render. It's considered controlled if the value is not `undefined`.",
            ].join('\n'),
          );
        }
      },
      { defer: true },
    );
  }

  const setValueIfUncontrolled: ControlledSetter<T | undefined> = (next) => {
    if (!isControlled) {
      setValue((prev) =>
        typeof next === 'function' ? (next as (previous: T | undefined) => T | undefined)(prev) : next,
      );
    }
  };

  return [value, setValueIfUncontrolled];
}
