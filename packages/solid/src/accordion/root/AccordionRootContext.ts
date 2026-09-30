import type { Accessor } from 'solid-js';
import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';
import type { AccordionRoot } from './AccordionRoot';

export interface AccordionRootContext<Value = any> {
  disabled: Accessor<boolean>;
  handleValueChange: (
    newValue: AccordionRoot.Value<Value>[number],
    nextOpen: boolean,
    eventDetails: AccordionRoot.ChangeEventDetails,
  ) => void;
  hiddenUntilFound: Accessor<boolean>;
  keepMounted: Accessor<boolean>;
  state: AccordionRoot.State<Value>;
  value: Accessor<AccordionRoot.Value<Value>>;
}

export const AccordionRootContext = createOptionalContext<AccordionRootContext<any>>();

export function useAccordionRootContext<Value = any>() {
  const context = useOptionalContext(AccordionRootContext) as
    | AccordionRootContext<Value>
    | undefined;
  if (context === undefined) {
    throw new Error(
      'Base UI: AccordionRootContext is missing. Accordion parts must be placed within <Accordion.Root>.',
    );
  }
  return context;
}
