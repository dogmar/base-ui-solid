import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';
import type { UseAnchorPositioningReturnValue } from '../../internals/useAnchorPositioning';

export type ToastPositionerContext = Pick<
  UseAnchorPositioningReturnValue,
  'side' | 'align' | 'arrowRef' | 'arrowUncentered' | 'arrowStyles'
>;

export const ToastPositionerContext = createOptionalContext<ToastPositionerContext>();

export function useToastPositionerContext() {
  const context = useOptionalContext(ToastPositionerContext);
  if (context === undefined) {
    throw new Error(
      'Base UI: ToastPositionerContext is missing. ToastPositioner parts must be placed within <Toast.Positioner>.',
    );
  }
  return context;
}
