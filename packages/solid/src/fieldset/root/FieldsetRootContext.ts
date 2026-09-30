import type { Accessor } from 'solid-js';
import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';

export interface FieldsetRootContext {
  legendId: Accessor<string | undefined>;
  setLegendId: (value: string | undefined | ((prev: string | undefined) => string | undefined)) => void;
  disabled: Accessor<boolean>;
}

export const FieldsetRootContext = createOptionalContext<FieldsetRootContext>();

export function useFieldsetRootContext(optional: true): FieldsetRootContext | undefined;
export function useFieldsetRootContext(optional?: false): FieldsetRootContext;
export function useFieldsetRootContext(optional = false) {
  const context = useOptionalContext(FieldsetRootContext);
  if (!context && !optional) {
    throw new Error(
      'Base UI: FieldsetRootContext is missing. Fieldset parts must be placed within <Fieldset.Root>.',
    );
  }
  return context;
}
