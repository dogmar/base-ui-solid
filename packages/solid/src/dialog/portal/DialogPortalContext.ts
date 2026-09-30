import type { Accessor } from 'solid-js';
import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';

/**
 * Holds the portal's `keepMounted` value.
 * Solid port note: the context carries an accessor for the reactive value.
 */
export const DialogPortalContext = createOptionalContext<Accessor<boolean>>();

export function useDialogPortalContext() {
  const value = useOptionalContext(DialogPortalContext);
  if (value === undefined) {
    throw new Error('Base UI: <Dialog.Portal> is missing.');
  }
  return value;
}
