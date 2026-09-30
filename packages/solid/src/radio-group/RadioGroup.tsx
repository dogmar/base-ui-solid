import { createSignal, omit, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useControlled } from '../solid-utils/useControlled';
import { applyRef } from '../solid-utils/refs';
import type { BaseUIComponentProps, HTMLProps } from '../internals/types';
import { useBaseUiId } from '../internals/useBaseUiId';
import { contains } from '../floating-ui-react/utils';
import { SHIFT } from '../internals/composite/composite';
import { CompositeRoot } from '../internals/composite/root/CompositeRoot';
import { useFieldRootContext } from '../internals/field-root-context/FieldRootContext';
import { useRegisterFieldControl } from '../internals/field-register-control/useRegisterFieldControl';
import { fieldValidityMapping } from '../internals/field-constants/constants';
import type { FieldRootState } from '../field/root/FieldRoot';
import { isEligibleInput } from '../field/root/useFieldValidation';
import { useFieldsetRootContext } from '../fieldset/root/FieldsetRootContext';
import { useFormContext } from '../internals/form-context/FormContext';
import { useLabelableContext } from '../internals/labelable-provider/LabelableContext';
import { useValueChanged } from '../internals/useValueChanged';
import { RadioGroupContext } from './RadioGroupContext';
import type { BaseUIChangeEventDetails } from '../internals/createBaseUIEventDetails';
import { REASONS } from '../internals/reasons';

const MODIFIER_KEYS = [SHIFT];

/**
 * Provides a shared state to a series of radio buttons.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Radio Group](https://base-ui.com/react/components/radio)
 */
export function RadioGroup<Value>(componentProps: RadioGroup.Props<Value>): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'className',
    'class',
    'disabled',
    'readOnly',
    'required',
    'onValueChange',
    'value',
    'defaultValue',
    'form',
    'name',
    'inputRef',
    'id',
    'style',
    'ref',
  );

  const {
    setTouched: setFieldTouched,
    setFocused,
    validationMode,
    name: fieldName,
    disabled: fieldDisabled,
    state: fieldState,
    validation,
    setDirty,
    setFilled,
    validityData,
  } = useFieldRootContext();
  const { labelId } = useLabelableContext();
  const { clearErrors, elementRef } = useFormContext();
  const fieldsetContext = useFieldsetRootContext(true);

  const disabled = () => fieldDisabled() || componentProps.disabled;
  const readOnly = () => componentProps.readOnly;
  const required = () => componentProps.required;
  const name = () => fieldName() ?? componentProps.name;
  const id = useBaseUiId(() =>
    typeof componentProps.id === 'string' ? componentProps.id : undefined,
  );

  const [checkedValue, setCheckedValueUnwrapped] = useControlled<Value | undefined>({
    controlled: () => componentProps.value,
    default: untrack(() => componentProps.defaultValue),
    name: 'RadioGroup',
    state: 'value',
  });
  const [touched, setTouched] = createSignal(false, { ownedWrite: true });

  const setCheckedValue = (value: Value, eventDetails: RadioGroup.ChangeEventDetails) => {
    componentProps.onValueChange?.(value, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setCheckedValueUnwrapped(() => value);
  };

  const controlRef = {
    get current() {
      return validation.getInputControl();
    },
  };
  const groupInputRef: { current: HTMLInputElement | null } = { current: null };
  const firstEnabledInputRef: { current: HTMLInputElement | null } = { current: null };

  // Only forwards the public `inputRef` and tracks the current representative for that forwarding.
  // The registry (`validation.registeredInputs`) is authoritative for validation and form-value
  // projection, so the group must not write `validation.inputRef`: a stale, unmounted radio left
  // there would become the Field's fallback once the registry empties and keep blocking submission.
  function setInputRef(hiddenInput: HTMLInputElement | null) {
    let cleanup: void | (() => void) | undefined = undefined;
    const inputRefProp = untrack(() => componentProps.inputRef);

    if (inputRefProp) {
      if (typeof inputRefProp === 'function') {
        cleanup = inputRefProp(hiddenInput);
      } else {
        inputRefProp.current = hiddenInput;
      }
    }

    groupInputRef.current = hiddenInput;

    return cleanup;
  }

  const registerInputRef = (input: HTMLInputElement | null) => {
    if (!input || input.disabled) {
      return undefined;
    }

    if (!firstEnabledInputRef.current) {
      firstEnabledInputRef.current = input;
    }

    const currentInput = groupInputRef.current;
    const cleanup =
      input.checked || currentInput == null || currentInput.disabled
        ? setInputRef(input)
        : undefined;

    // Detach when this input unmounts while still forwarded, so consumers don't
    // keep holding a disconnected node. The input may have become the forwarded
    // one after attach (via the re-registration effect), so always return this.
    return () => {
      if (firstEnabledInputRef.current === input) {
        firstEnabledInputRef.current = null;
      }
      if (groupInputRef.current === input) {
        if (cleanup) {
          cleanup();
          groupInputRef.current = null;
        } else {
          void setInputRef(null);
        }
      } else {
        cleanup?.();
      }
    };
  };

  const getFormValue = () => {
    const formElement = elementRef.current;
    if (!formElement) {
      return untrack(checkedValue) ?? null;
    }

    for (const input of validation.registeredInputs.keys()) {
      if (input.checked && isEligibleInput(input, formElement)) {
        return untrack(checkedValue) ?? null;
      }
    }

    return null;
  };

  useRegisterFieldControl(
    controlRef,
    id,
    () => checkedValue() ?? null,
    getFormValue,
    () => !disabled(),
    () => componentProps.name,
  );

  useValueChanged(checkedValue, () => {
    const currentValue = untrack(checkedValue);

    clearErrors(untrack(name));

    setDirty(currentValue !== untrack(validityData).initialValue);
    setFilled(currentValue != null);

    validation.change(currentValue);

    const fallbackInput = firstEnabledInputRef.current;
    if (currentValue == null && fallbackInput && !fallbackInput.disabled) {
      // Imperative re-point outside the ref lifecycle; the ref-callback cleanup isn't tracked here.
      void setInputRef(fallbackInput);
    }
  });

  const ariaLabelledby = () => labelId() ?? fieldsetContext?.legendId();

  const state: RadioGroupState = {
    get disabled() {
      return disabled() ?? false;
    },
    get touched() {
      return fieldState.touched;
    },
    get dirty() {
      return fieldState.dirty;
    },
    get valid() {
      return fieldState.valid;
    },
    get filled() {
      return fieldState.filled;
    },
    get focused() {
      return fieldState.focused;
    },
    get required() {
      return required() ?? false;
    },
    get readOnly() {
      return readOnly() ?? false;
    },
  };

  const contextValue: RadioGroupContext<Value> = {
    checkedValue,
    disabled,
    form: () => componentProps.form,
    validation,
    name,
    readOnly,
    registerInputRef,
    required,
    setCheckedValue,
    setTouched,
    touched,
  };

  const defaultProps: HTMLProps = {
    get id() {
      return componentProps.id;
    },
    role: 'radiogroup',
    // Solid renders boolean attribute values as presence/absence; aria
    // attributes need explicit strings.
    get 'aria-required'() {
      return required() ? 'true' : undefined;
    },
    get 'aria-disabled'() {
      return disabled() ? 'true' : undefined;
    },
    get 'aria-readonly'() {
      return readOnly() ? 'true' : undefined;
    },
    get 'aria-labelledby'() {
      return ariaLabelledby();
    },
    // React's `onFocus`/`onBlur` fire for descendant focus changes; the Solid
    // equivalents are the bubbling focusin/focusout events.
    onFocusIn() {
      setFocused(true);
    },
    onFocusOut(event: FocusEvent) {
      if (!contains(event.currentTarget as Element, event.relatedTarget as Element | null)) {
        setFieldTouched(true);
        setFocused(false);

        if (untrack(validationMode) === 'onBlur') {
          validation.commit(untrack(checkedValue));
        }
      }
    },
  };

  // Mirrors the React `onKeyDownCapture` handler: a native capture listener so
  // the flag is set before the composite root moves focus (its keydown handler
  // triggers the next radio's focus event synchronously, which reads `touched`).
  function markTouchedOnArrowKey(event: KeyboardEvent) {
    if (event.key.startsWith('Arrow')) {
      setTouched(true);
      setFocused(true);
    }
  }
  const touchTrackerRef = (element: HTMLElement | null) => {
    element?.addEventListener('keydown', markTouchedOnArrowKey, true);
  };

  return (
    <RadioGroupContext value={contextValue as RadioGroupContext<any>}>
      <CompositeRoot
        render={componentProps.render}
        className={componentProps.className}
        class={componentProps.class}
        style={componentProps.style}
        state={state}
        props={[
          defaultProps,
          elementProps,
          (props: HTMLProps) => validation.getValidationProps(disabled() ?? false, props),
        ]}
        refs={[touchTrackerRef, (el: HTMLElement | null) => applyRef(componentProps.ref, el)]}
        stateAttributesMapping={fieldValidityMapping}
        enableHomeAndEndKeys={false}
        modifierKeys={MODIFIER_KEYS}
      />
    </RadioGroupContext>
  );
}

export interface RadioGroupState extends FieldRootState {
  /**
   * Whether the user should be unable to select a different radio button in the group.
   */
  readOnly: boolean;
  /**
   * Whether the user must tick a radio button within the group before submitting a form.
   */
  required: boolean;
}

export interface RadioGroupProps<Value = any> extends Omit<
  BaseUIComponentProps<'div', RadioGroupState>,
  'value'
> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the user should be unable to select a different radio button in the group.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the user must choose a value before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the radio inputs.
   * Useful when the radio group is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * The controlled value of the radio item that should be currently selected.
   *
   * To render an uncontrolled radio group, use the `defaultValue` prop instead.
   */
  value?: Value | undefined;
  /**
   * The uncontrolled value of the radio button that should be initially selected.
   *
   * To render a controlled radio group, use the `value` prop instead.
   */
  defaultValue?: Value | undefined;
  /**
   * Callback fired when the value changes.
   */
  onValueChange?: ((value: Value, eventDetails: RadioGroup.ChangeEventDetails) => void) | undefined;
  /**
   * A ref to access the hidden input element.
   */
  inputRef?:
    | ((element: HTMLInputElement | null) => void | (() => void))
    | { current: HTMLInputElement | null }
    | undefined;
}

export type RadioGroupChangeEventReason = typeof REASONS.none;

export type RadioGroupChangeEventDetails = BaseUIChangeEventDetails<RadioGroup.ChangeEventReason>;

export namespace RadioGroup {
  export type State = RadioGroupState;
  export type Props<TValue = any> = RadioGroupProps<TValue>;
  export type ChangeEventReason = RadioGroupChangeEventReason;
  export type ChangeEventDetails = RadioGroupChangeEventDetails;
}
