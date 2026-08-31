import type { Accessor } from 'solid-js';
import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';
import type { ProgressRootState } from './ProgressRoot';

export type ProgressRootContext = {
  /**
   * Formatted value of the component.
   */
  formattedValue: Accessor<string>;
  /**
   * The value normalized to a `0`–`100` percentage of the range, clamped to those bounds.
   * `null` while the progress is indeterminate.
   */
  percentageValue: Accessor<number | null>;
  /**
   * Value of the component.
   */
  value: Accessor<number | null>;
  setLabelId: (
    value: string | undefined | ((prev: string | undefined) => string | undefined),
  ) => void;
  state: ProgressRootState;
};

/**
 * @internal
 */
export const ProgressRootContext = createOptionalContext<ProgressRootContext>();

export function useProgressRootContext() {
  const context = useOptionalContext(ProgressRootContext);
  if (context === undefined) {
    throw new Error(
      'Base UI: ProgressRootContext is missing. Progress parts must be placed within <Progress.Root>.',
    );
  }

  return context;
}
