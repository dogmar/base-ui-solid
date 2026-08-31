import { onCleanup } from 'solid-js';
import { Timeout } from '@base-ui/utils/useTimeout';
import { AnimationFrame } from '@base-ui/utils/useAnimationFrame';
import { Interval } from '@base-ui/utils/useInterval';

export { Timeout, AnimationFrame, Interval };

/**
 * A `setTimeout` with automatic cleanup and guard.
 * Solid port of `useTimeout` from `@base-ui/utils`; call in a component body.
 */
export function useTimeout(): Timeout {
  const timeout = Timeout.create();
  onCleanup(timeout.clear);
  return timeout;
}

/**
 * A `requestAnimationFrame` with automatic cleanup and guard.
 * Solid port of `useAnimationFrame` from `@base-ui/utils`; call in a component body.
 */
export function useAnimationFrame(): AnimationFrame {
  const frame = AnimationFrame.create();
  onCleanup(frame.cancel);
  return frame;
}

/**
 * A `setInterval` with automatic cleanup and guard.
 * Solid port of `useInterval` from `@base-ui/utils`; call in a component body.
 */
export function useInterval(): Interval {
  const interval = Interval.create();
  onCleanup(interval.clear);
  return interval;
}
