import type { Accessor } from 'solid-js';
import { createOptionalContext, useOptionalContext } from '../solid-utils/optionalContext';
import type { UseFieldValidationReturnValue } from '../field/root/useFieldValidation';
import type { BaseUIChangeEventDetails } from '../internals/createBaseUIEventDetails';
import type { BaseUIEventReasons } from '../internals/reasons';

export interface RadioGroupContext<Value> {
  disabled: Accessor<boolean | undefined>;
  readOnly: Accessor<boolean | undefined>;
  required: Accessor<boolean | undefined>;
  form: Accessor<string | undefined>;
  name: Accessor<string | undefined>;
  checkedValue: Accessor<Value | undefined>;
  setCheckedValue: (
    value: Value,
    eventDetails: BaseUIChangeEventDetails<BaseUIEventReasons['none']>,
  ) => void;
  touched: Accessor<boolean>;
  setTouched: (value: boolean | ((prev: boolean) => boolean)) => void;
  validation?: UseFieldValidationReturnValue | undefined;
  /**
   * Registers a hidden radio input with the group so the public `inputRef` can be
   * forwarded to the current representative input. Returns a cleanup that detaches
   * the input again when it unmounts.
   */
  registerInputRef: (element: HTMLInputElement | null) => void | (() => void);
}

export const RadioGroupContext = createOptionalContext<RadioGroupContext<any>>();

export function useRadioGroupContext() {
  return useOptionalContext(RadioGroupContext);
}
