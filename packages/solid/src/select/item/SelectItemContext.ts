import type { Accessor } from 'solid-js';
import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';
import type { RefObject } from '../../solid-utils/refs';

export interface SelectItemContext {
  selected: Accessor<boolean>;
  index: Accessor<number>;
  textRef: RefObject<HTMLElement>;
  selectedByFocus: Accessor<boolean>;
}

export const SelectItemContext = createOptionalContext<SelectItemContext>();

export function useSelectItemContext() {
  const context = useOptionalContext(SelectItemContext);
  if (!context) {
    throw new Error(
      'Base UI: SelectItemContext is missing. SelectItem parts must be placed within <Select.Item>.',
    );
  }
  return context;
}
