import type { Accessor } from 'solid-js';
import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';

export type MeterRootContext = {
  formattedValue: Accessor<string>;
  /**
   * The value normalized to a `0`–`100` percentage of the range, clamped to those bounds.
   */
  percentageValue: Accessor<number>;
  setLabelId: (
    value: string | undefined | ((prev: string | undefined) => string | undefined),
  ) => void;
  value: Accessor<number>;
};

export const MeterRootContext = createOptionalContext<MeterRootContext>();

export function useMeterRootContext() {
  const context = useOptionalContext(MeterRootContext);
  if (context === undefined) {
    throw new Error(
      'Base UI: MeterRootContext is missing. Meter parts must be placed within <Meter.Root>.',
    );
  }

  return context;
}
