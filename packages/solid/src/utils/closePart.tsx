import { createRenderEffect, createSignal, onCleanup, type Accessor } from 'solid-js';
import { createOptionalContext, useOptionalContext } from '../solid-utils/optionalContext';

interface ClosePartContextValue {
  register: () => () => void;
}

export const ClosePartContext = createOptionalContext<ClosePartContextValue>();

export function useClosePartCount(): {
  context: ClosePartContextValue;
  hasClosePart: Accessor<boolean>;
} {
  const [closePartCount, setClosePartCount] = createSignal(0, { ownedWrite: true });

  const register = () => {
    setClosePartCount((count) => count + 1);

    return () => {
      setClosePartCount((count) => Math.max(0, count - 1));
    };
  };

  const context = { register };

  return {
    context,
    hasClosePart: () => closePartCount() > 0,
  };
}

export function useClosePartRegistration() {
  const context = useOptionalContext(ClosePartContext);

  // Guarded per PORTING.md rule 20a: a render effect's apply phase may re-run with an
  // unchanged computed value, and re-registering would inflate the close part count.
  let unregister: (() => void) | undefined;

  createRenderEffect(
    () => context,
    (currentContext) => {
      if (unregister !== undefined) {
        return;
      }
      unregister = currentContext?.register();
    },
  );

  void onCleanup(() => {
    unregister?.();
    unregister = undefined;
  });
}
