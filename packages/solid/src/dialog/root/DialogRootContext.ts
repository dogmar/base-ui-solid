import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';
import { DialogStore } from '../store/DialogStore';

export const DialogRootContext = createOptionalContext<DialogStore<unknown>>();

export function useDialogRootContext(optional?: false): DialogStore<unknown>;
export function useDialogRootContext(optional: true): DialogStore<unknown> | undefined;
export function useDialogRootContext(optional?: boolean) {
  const store = useOptionalContext(DialogRootContext);

  if (!optional && store === undefined) {
    throw new Error(
      'Base UI: DialogRootContext is missing. Dialog parts must be placed within <Dialog.Root>.',
    );
  }

  return store;
}
