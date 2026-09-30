import { createEffect, type Accessor } from 'solid-js';

/**
 * Calls `onChange` whenever the reactive `value` changes (not on the initial run).
 * Solid port of `useValueChanged`.
 */
export function useValueChanged<T>(value: Accessor<T>, onChange: (previousValue: T) => void) {
  createEffect(
    value,
    (_current, previous) => {
      onChange(previous as T);
    },
    { defer: true },
  );
}
