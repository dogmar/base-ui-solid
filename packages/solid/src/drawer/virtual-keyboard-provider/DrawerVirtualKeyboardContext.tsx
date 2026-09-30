import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';

export interface DrawerVirtualKeyboardContext {
  onTouchStart: (event: TouchEvent) => void;
  // Driven by the viewport's native `touchmove` listener so it still fires when the
  // swipe gesture claims the event with `stopPropagation()`.
  onTouchMove: (event: TouchEvent) => void;
  onTouchEnd: (event: TouchEvent) => void;
  onTouchCancel: () => void;
}

export const DrawerVirtualKeyboardContext =
  createOptionalContext<DrawerVirtualKeyboardContext>();

export function useDrawerVirtualKeyboardContext() {
  return useOptionalContext(DrawerVirtualKeyboardContext);
}
