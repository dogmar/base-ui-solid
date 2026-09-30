import type { Accessor } from 'solid-js';
import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';

export type TextDirection = 'ltr' | 'rtl';

export type DirectionContext = {
  direction: Accessor<TextDirection>;
};

export const DirectionContext = createOptionalContext<DirectionContext>();

export function useDirection(): Accessor<TextDirection> {
  const context = useOptionalContext(DirectionContext);

  return () => context?.direction() ?? 'ltr';
}
