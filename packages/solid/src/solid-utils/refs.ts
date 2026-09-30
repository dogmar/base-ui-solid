/**
 * Ref utilities for the Solid port.
 *
 * React code in Base UI uses `React.useRef` objects and callback refs
 * interchangeably. To keep ports mechanical, this module provides a
 * `{ current }`-shaped ref object plus helpers that accept either shape
 * (or arrays of them), mirroring `useMergedRefs` from `@base-ui/utils`.
 */

export interface RefObject<T> {
  current: T | null;
}

export type RefCallback<T> = (el: T | null) => void;

export type Ref<T> = RefCallback<T> | RefObject<T> | null | undefined;

/**
 * A ref input of any supported shape, including arbitrarily nested arrays.
 */
export type RefInput<T> = Ref<T> | RefInput<T>[];

export function createRef<T>(initial: T | null = null): RefObject<T> {
  return { current: initial };
}

/**
 * Assigns `value` to a ref of any supported shape (callback, object, array of either).
 */
export function applyRef<T>(ref: RefInput<T> | undefined, value: T | null): void {
  if (ref == null) {
    return;
  }
  if (Array.isArray(ref)) {
    for (const inner of ref) {
      applyRef(inner, value);
    }
    return;
  }
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  ref.current = value;
}

/**
 * Composes any number of refs into a single callback ref.
 * Mirrors `useMergedRefs` from `@base-ui/utils` for the Solid port.
 */
export function useMergedRefs<T>(...refs: Array<Ref<T> | undefined>): RefCallback<T> {
  return (value) => {
    for (const ref of refs) {
      applyRef(ref, value);
    }
  };
}

export function useMergedRefsN<T>(refs: Array<Ref<T> | undefined>): RefCallback<T> {
  return (value) => {
    for (const ref of refs) {
      applyRef(ref, value);
    }
  };
}
