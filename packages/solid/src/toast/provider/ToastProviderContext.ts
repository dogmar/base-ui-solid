import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';
import { ToastStore } from '../store';

export type ToastContext = ToastStore;

export const ToastContext = createOptionalContext<ToastContext>();

export function useToastProviderContext() {
  const context = useOptionalContext(ToastContext);
  if (!context) {
    throw new Error('Base UI: useToastManager must be used within <Toast.Provider>.');
  }
  return context;
}
