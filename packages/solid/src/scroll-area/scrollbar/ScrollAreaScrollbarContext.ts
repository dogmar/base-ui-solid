import type { Accessor } from 'solid-js';
import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';

export type ScrollAreaScrollbarContext = Accessor<'horizontal' | 'vertical'>;

export const ScrollAreaScrollbarContext = createOptionalContext<ScrollAreaScrollbarContext>();

export function useScrollAreaScrollbarContext() {
  const context = useOptionalContext(ScrollAreaScrollbarContext);
  if (context === undefined) {
    throw new Error(
      'Base UI: ScrollAreaScrollbarContext is missing. ScrollAreaScrollbar parts must be placed within <ScrollArea.Scrollbar>.',
    );
  }
  return context;
}
