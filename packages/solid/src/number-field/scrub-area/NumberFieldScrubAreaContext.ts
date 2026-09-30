import type { Accessor } from 'solid-js';
import type { RefObject } from '../../solid-utils/refs';
import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';

export interface NumberFieldScrubAreaContext {
  isScrubbing: Accessor<boolean>;
  isTouchInput: Accessor<boolean>;
  isPointerLockDenied: Accessor<boolean>;
  scrubAreaCursorRef: RefObject<HTMLSpanElement>;
}

export const NumberFieldScrubAreaContext = createOptionalContext<NumberFieldScrubAreaContext>();

export function useNumberFieldScrubAreaContext() {
  const context = useOptionalContext(NumberFieldScrubAreaContext);
  if (context === undefined) {
    throw new Error(
      'Base UI: NumberFieldScrubAreaContext is missing. NumberFieldScrubArea parts must be placed within <NumberField.ScrubArea>.',
    );
  }
  return context;
}
