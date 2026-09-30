import type { Accessor } from 'solid-js';
import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';

export interface SelectGroupContext {
  labelId: Accessor<string | undefined>;
  setLabelId: (
    value: string | undefined | ((prev: string | undefined) => string | undefined),
  ) => void;
}

export const SelectGroupContext = createOptionalContext<SelectGroupContext>();

export function useSelectGroupContext() {
  const context = useOptionalContext(SelectGroupContext);
  if (context === undefined) {
    throw new Error(
      'Base UI: SelectGroupContext is missing. SelectGroup parts must be placed within <Select.Group>.',
    );
  }
  return context;
}
