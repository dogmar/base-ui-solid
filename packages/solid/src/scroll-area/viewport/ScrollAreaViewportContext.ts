import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';

export interface ScrollAreaViewportContext {
  computeThumbPosition: () => void;
}

export const ScrollAreaViewportContext = createOptionalContext<ScrollAreaViewportContext>();

export function useScrollAreaViewportContext() {
  const context = useOptionalContext(ScrollAreaViewportContext);
  if (context === undefined) {
    throw new Error(
      'Base UI: ScrollAreaViewportContext missing. ScrollAreaViewport parts must be placed within <ScrollArea.Viewport>.',
    );
  }
  return context;
}
