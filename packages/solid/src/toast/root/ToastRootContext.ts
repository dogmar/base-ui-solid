import type { Setter } from 'solid-js';
import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';
import type { ToastObject } from '../useToastManager';

export interface ToastRootContext {
  toast: ToastObject<any>;
  setTitleId: Setter<string | undefined>;
  setDescriptionId: Setter<string | undefined>;
  visibleIndex: number;
  expanded: boolean;
  recalculateHeight: (flushSync?: boolean) => void;
}

export const ToastRootContext = createOptionalContext<ToastRootContext>();

export function useToastRootContext(): ToastRootContext {
  const context = useOptionalContext(ToastRootContext);
  if (!context) {
    throw new Error(
      'Base UI: ToastRootContext is missing. Toast parts must be used within <Toast.Root>.',
    );
  }
  return context as ToastRootContext;
}
