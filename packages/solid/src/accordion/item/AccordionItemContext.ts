import type { Accessor } from 'solid-js';
import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';
import type { AccordionItemState } from './AccordionItem';

export interface AccordionItemContext {
  defaultTriggerId: Accessor<string | undefined>;
  open: Accessor<boolean>;
  state: AccordionItemState;
  setTriggerId: (
    next:
      | string
      | null
      | undefined
      | ((prev: string | null | undefined) => string | null | undefined),
  ) => void;
  triggerId: Accessor<string | undefined>;
}

export const AccordionItemContext = createOptionalContext<AccordionItemContext>();

export function useAccordionItemContext() {
  const context = useOptionalContext(AccordionItemContext);
  if (context === undefined) {
    throw new Error(
      'Base UI: AccordionItemContext is missing. Accordion parts must be placed within <Accordion.Item>.',
    );
  }
  return context;
}
