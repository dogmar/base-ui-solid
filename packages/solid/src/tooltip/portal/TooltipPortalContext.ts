import type { Accessor } from 'solid-js';
import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';

/**
 * Holds the portal's `keepMounted` value.
 * Solid port note: the context carries an accessor for the reactive value.
 */
export const TooltipPortalContext = createOptionalContext<Accessor<boolean>>();

export function useTooltipPortalContext() {
  const value = useOptionalContext(TooltipPortalContext);
  if (value === undefined) {
    throw new Error('Base UI: <Tooltip.Portal> is missing.');
  }
  return value;
}
