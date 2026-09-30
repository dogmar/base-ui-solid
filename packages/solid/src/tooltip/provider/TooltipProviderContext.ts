import type { Accessor } from 'solid-js';
import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';

/**
 * Holds the provider's `delay` value. `closeDelay` is handled by the delay group.
 * Solid port note: the context carries an accessor for the reactive value.
 */
export const TooltipProviderContext = createOptionalContext<Accessor<number | undefined>>();

export function useTooltipProviderContext(): Accessor<number | undefined> | undefined {
  return useOptionalContext(TooltipProviderContext);
}
