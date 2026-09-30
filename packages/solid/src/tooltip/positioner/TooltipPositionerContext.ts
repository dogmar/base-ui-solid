import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';
import type { UseAnchorPositioningReturnValue } from '../../internals/useAnchorPositioning';

export type TooltipPositionerContext = Pick<
  UseAnchorPositioningReturnValue,
  'side' | 'align' | 'arrowRef' | 'arrowUncentered' | 'arrowStyles'
>;

export const TooltipPositionerContext = createOptionalContext<TooltipPositionerContext>();

export function useTooltipPositionerContext() {
  const context = useOptionalContext(TooltipPositionerContext);
  if (context === undefined) {
    throw new Error(
      'Base UI: TooltipPositionerContext is missing. TooltipPositioner parts must be placed within <Tooltip.Positioner>.',
    );
  }
  return context;
}
