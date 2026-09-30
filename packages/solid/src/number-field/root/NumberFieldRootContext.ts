import type { Accessor } from 'solid-js';
import type { NumberFieldRoot, NumberFieldRootState } from './NumberFieldRoot';
import type { EventWithOptionalKeyState, IncrementValueParameters } from '../utils/types';
import type { RefObject } from '../../solid-utils/refs';
import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';

export type InputMode = 'numeric' | 'decimal' | 'text';

export interface NumberFieldRootContext {
  minWithDefault: Accessor<number>;
  maxWithDefault: Accessor<number>;
  id: Accessor<string | undefined>;
  setValue: (value: number | null, details: NumberFieldRoot.ChangeEventDetails) => boolean;
  getStepAmount: (event?: EventWithOptionalKeyState) => number;
  incrementValue: (amount: number, params: IncrementValueParameters) => boolean;
  inputRef: RefObject<HTMLInputElement>;
  focusInput: () => void;
  allowInputSyncRef: RefObject<boolean>;
  formatOptionsRef: { readonly current: Intl.NumberFormatOptions | undefined };
  valueRef: RefObject<number | null>;
  lastChangedValueRef: RefObject<number | null>;
  hasPendingCommitRef: RefObject<boolean>;
  name: Accessor<string | undefined>;
  nameProp: Accessor<string | undefined>;
  inputMode: Accessor<InputMode>;
  getAllowedNonNumericKeys: () => Set<string>;
  min: Accessor<number | undefined>;
  max: Accessor<number | undefined>;
  setInputValue: (value: string | ((prev: string) => string)) => void;
  locale: Accessor<Intl.LocalesArgument>;
  setIsScrubbing: (value: boolean) => void;
  state: NumberFieldRootState;
  onValueCommitted: (
    value: number | null,
    eventDetails: NumberFieldRoot.CommitEventDetails,
  ) => void;
}

export const NumberFieldRootContext = createOptionalContext<NumberFieldRootContext>();

export function useNumberFieldRootContext() {
  const context = useOptionalContext(NumberFieldRootContext);
  if (context === undefined) {
    throw new Error(
      'Base UI: NumberFieldRootContext is missing. NumberField parts must be placed within <NumberField.Root>.',
    );
  }

  return context;
}
