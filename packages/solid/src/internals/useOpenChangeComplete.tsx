import { createEffect } from 'solid-js';
import { useAnimationsFinished } from './useAnimationsFinished';
import type { RefObject } from '../solid-utils/refs';

/**
 * Calls the provided function when the CSS open/close animation or transition completes.
 * Reactive parameters (`enabled`, `open`) should be provided through getters.
 */
export function useOpenChangeComplete(parameters: UseOpenChangeCompleteParameters) {
  const runOnceAnimationsFinish = useAnimationsFinished(
    parameters.ref,
    () => parameters.open ?? false,
    parameters.batch ?? false,
  );

  createEffect(
    () => ({ enabled: parameters.enabled ?? true, open: parameters.open }),
    (current) => {
      if (!current.enabled) {
        return undefined;
      }

      const abortController = new AbortController();

      runOnceAnimationsFinish(() => parameters.onComplete(), abortController.signal);

      return () => {
        abortController.abort();
      };
    },
  );
}

export interface UseOpenChangeCompleteParameters {
  /**
   * Whether the hook is enabled.
   * @default true
   */
  enabled?: boolean | undefined;
  /**
   * Whether the element is open.
   */
  open?: boolean | undefined;
  /**
   * Ref to the element being closed.
   */
  ref: RefObject<HTMLElement>;
  /**
   * Whether completions ready in the same microtask may be coalesced into a single commit.
   * Only safe when `onComplete` doesn't read state that another completion can change.
   * @default false
   */
  batch?: boolean | undefined;
  /**
   * Function to call when the animation completes (or there is no animation).
   */
  onComplete: () => void;
}

export interface UseOpenChangeCompleteState {}
