import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';
import type { SwitchRootState } from './SwitchRoot';

export type SwitchRootContext = SwitchRootState;

export const SwitchRootContext = createOptionalContext<SwitchRootContext>();

export function useSwitchRootContext() {
  const context = useOptionalContext(SwitchRootContext);
  if (context === undefined) {
    throw new Error(
      'Base UI: SwitchRootContext is missing. Switch parts must be placed within <Switch.Root>.',
    );
  }

  return context;
}
