import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';
import type { CheckboxRootState } from './CheckboxRoot';

export type CheckboxRootContext = CheckboxRootState;

export const CheckboxRootContext = createOptionalContext<CheckboxRootContext>();

export function useCheckboxRootContext() {
  const context = useOptionalContext(CheckboxRootContext);
  if (context === undefined) {
    throw new Error(
      'Base UI: CheckboxRootContext is missing. Checkbox parts must be placed within <Checkbox.Root>.',
    );
  }

  return context;
}
