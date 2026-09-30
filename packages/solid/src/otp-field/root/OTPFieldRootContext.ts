import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';
import type { OTPFieldRoot, OTPFieldRootState } from './OTPFieldRoot';
import type { OTPFieldInputState } from '../input/OTPFieldInput';

export interface OTPFieldRootContext {
  activeIndex: Accessor<number>;
  autoComplete: Accessor<string | undefined>;
  disabled: Accessor<boolean>;
  form: Accessor<string | undefined>;
  focusInput: (index: number) => void;
  queueFocusInput: (index: number, value: string) => void;
  getInputId: (index: number) => string | undefined;
  handleInputBlur: (event: FocusEvent) => void;
  handleInputFocus: (index: number, event: FocusEvent) => void;
  inputMode: Accessor<JSX.HTMLAttributes<HTMLInputElement>['inputmode']>;
  inputAriaLabelledBy: Accessor<string | undefined>;
  invalid: Accessor<boolean | undefined>;
  length: Accessor<number>;
  mask: Accessor<boolean>;
  pattern: Accessor<string | undefined>;
  reportValueInvalid: (value: string, details: OTPFieldRoot.InvalidEventDetails) => void;
  readOnly: Accessor<boolean>;
  required: Accessor<boolean>;
  normalizeValue: Accessor<((value: string) => string) | undefined>;
  setValue: (value: string, details: OTPFieldRoot.ChangeEventDetails) => string | null;
  state: OTPFieldRootState;
  validationType: Accessor<OTPFieldRoot.ValidationType>;
  value: Accessor<string>;
}

export const OTPFieldRootContext = createOptionalContext<OTPFieldRootContext>();

export function useOTPFieldRootContext() {
  const context = useOptionalContext(OTPFieldRootContext);

  if (context === undefined) {
    throw new Error(
      'Base UI: OTPFieldRootContext is missing. OTPField parts must be placed within <OTPField.Root>.',
    );
  }

  return context;
}

export function getOTPFieldInputState(
  state: OTPFieldRootState,
  value: Accessor<string>,
  index: Accessor<number>,
): OTPFieldInputState {
  return {
    get disabled() {
      return state.disabled;
    },
    get touched() {
      return state.touched;
    },
    get dirty() {
      return state.dirty;
    },
    get valid() {
      return state.valid;
    },
    get focused() {
      return state.focused;
    },
    get complete() {
      return state.complete;
    },
    get length() {
      return state.length;
    },
    get readOnly() {
      return state.readOnly;
    },
    get required() {
      return state.required;
    },
    get value() {
      return value();
    },
    get index() {
      return index();
    },
    get filled() {
      return value() !== '';
    },
  };
}
