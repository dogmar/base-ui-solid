import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';
import type { RadioRootState } from './RadioRoot';

export type RadioRootContext = RadioRootState;

export const RadioRootContext = createOptionalContext<RadioRootContext>();

export function useRadioRootContext() {
  const value = useOptionalContext(RadioRootContext);
  if (value === undefined) {
    throw new Error(
      'Base UI: RadioRootContext is missing. Radio parts must be placed within <Radio.Root>.',
    );
  }

  return value;
}
