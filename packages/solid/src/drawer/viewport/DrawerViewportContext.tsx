import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';

/**
 * Solid port note: reactive fields are exposed as accessors.
 */
interface DrawerViewportContextValue {
  swiping: Accessor<boolean>;
  getDragStyles: () => JSX.CSSProperties;
  swipeStrength: Accessor<number | null>;
  setSwipeDismissed: (dismissed: boolean) => void;
}

export const DrawerViewportContext = createOptionalContext<DrawerViewportContextValue>();

export function useDrawerViewportContext() {
  return useOptionalContext(DrawerViewportContext) ?? null;
}
