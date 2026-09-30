import type { Accessor } from 'solid-js';
import type { Side, UseAnchorPositioningReturnValue } from '../../internals/useAnchorPositioning';
import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';
import type { RefObject } from '../../solid-utils/refs';

export interface SelectPositionerContext extends Omit<UseAnchorPositioningReturnValue, 'side'> {
  side: Accessor<'none' | Side>;
  alignItemWithTriggerActive: Accessor<boolean>;
  setControlledAlignItemWithTrigger: (value: boolean) => void;
  scrollUpArrowRef: RefObject<HTMLDivElement>;
  scrollDownArrowRef: RefObject<HTMLDivElement>;
}

export const SelectPositionerContext = createOptionalContext<SelectPositionerContext>();

export function useSelectPositionerContext() {
  const context = useOptionalContext(SelectPositionerContext);
  if (!context) {
    throw new Error(
      'Base UI: SelectPositionerContext is missing. SelectPositioner parts must be placed within <Select.Positioner>.',
    );
  }
  return context;
}
