import type { RefObject } from '../solid-utils/refs';

/**
 * If the provided argument is a ref object, returns its `current` value.
 * Otherwise, returns the argument itself.
 */
export function resolveRef<T extends HTMLElement>(
  maybeRef: T | RefObject<T> | null | undefined,
): T | null | undefined {
  if (maybeRef == null) {
    return maybeRef;
  }

  return 'current' in maybeRef ? maybeRef.current : maybeRef;
}
