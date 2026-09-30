import { createEffect, createRenderEffect, createSignal, untrack, type Accessor } from 'solid-js';
import { AnimationFrame } from '@base-ui/utils/useAnimationFrame';

export type TransitionStatus = 'starting' | 'ending' | 'idle' | undefined;

export interface UseTransitionStatusReturnValue {
  mounted: Accessor<boolean>;
  setMounted: (value: boolean | ((prev: boolean) => boolean)) => void;
  transitionStatus: Accessor<TransitionStatus>;
}

/**
 * Provides a status string for CSS animations. Solid port of `useTransitionStatus`.
 * @param open - accessor that determines if the element is open.
 * @param enableIdleState - a boolean that enables the `'idle'` state between `'starting'` and `'ending'`
 * @param deferEndingState - a boolean that delays the `'ending'` state by a frame
 * @param animateInitialOpen - a boolean that makes an element which mounts already open still go
 *   through `'starting'`. Off by default so content that was open on the first render doesn't
 *   animate in.
 */
export function useTransitionStatus(
  open: Accessor<boolean>,
  enableIdleState: boolean = false,
  deferEndingState: boolean = false,
  animateInitialOpen: boolean = false,
): UseTransitionStatusReturnValue {
  const initialOpen = untrack(open);

  const [transitionStatus, setTransitionStatus] = createSignal<TransitionStatus>(
    initialOpen && enableIdleState ? 'idle' : undefined,
    { ownedWrite: true },
  );
  const [mounted, setMounted] = createSignal(initialOpen && !animateInitialOpen, {
    ownedWrite: true,
  });

  // Mirrors the React implementation's render-phase state adjustments: both
  // writes land in the same flush, so the element enters the DOM with the
  // `starting` status already applied.
  createRenderEffect(
    () => ({ open: open(), mounted: mounted(), status: transitionStatus() }),
    (current) => {
      if (current.open && !current.mounted) {
        setMounted(true);
        setTransitionStatus('starting');
      }

      if (
        !current.open &&
        current.mounted &&
        current.status !== 'ending' &&
        !deferEndingState
      ) {
        setTransitionStatus('ending');
      }

      if (!current.open && !current.mounted && current.status === 'ending') {
        setTransitionStatus(undefined);
      }
    },
  );

  createEffect(
    () => ({ open: open(), mounted: mounted(), status: transitionStatus() }),
    (current) => {
      if (!current.open && current.mounted && current.status !== 'ending' && deferEndingState) {
        const frame = AnimationFrame.request(() => {
          setTransitionStatus('ending');
        });

        return () => {
          AnimationFrame.cancel(frame);
        };
      }

      return undefined;
    },
  );

  createEffect(
    () => open(),
    (isOpen) => {
      if (!isOpen || enableIdleState) {
        return undefined;
      }

      const frame = AnimationFrame.request(() => {
        setTransitionStatus(undefined);
      });

      return () => {
        AnimationFrame.cancel(frame);
      };
    },
  );

  createEffect(
    () => ({ open: open(), mounted: mounted(), status: transitionStatus() }),
    (current) => {
      if (!current.open || !enableIdleState) {
        return undefined;
      }

      if (current.open && current.mounted && current.status !== 'idle') {
        setTransitionStatus('starting');
      }

      const frame = AnimationFrame.request(() => {
        setTransitionStatus('idle');
      });

      return () => {
        AnimationFrame.cancel(frame);
      };
    },
  );

  return {
    mounted,
    setMounted,
    transitionStatus,
  };
}
