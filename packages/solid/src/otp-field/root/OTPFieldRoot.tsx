import {
  createEffect,
  createMemo,
  createSignal,
  omit,
  untrack,
  Show,
  type Accessor,
} from 'solid-js';
import type { JSX } from '@solidjs/web';
import { warn } from '@base-ui/utils/warn';
import { ownerDocument } from '@base-ui/utils/owner';
import { contains } from '../../floating-ui-react/utils/element';
import { CompositeList } from '../../internals/composite/list/CompositeList';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { useRegisterFieldControl } from '../../internals/field-register-control/useRegisterFieldControl';
import type { FieldRootState } from '../../field/root/FieldRoot';
import { useFormContext } from '../../internals/form-context/FormContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useAriaLabelledBy } from '../../internals/labelable-provider/useAriaLabelledBy';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { useRenderElement } from '../../internals/useRenderElement';
import { useValueChanged } from '../../internals/useValueChanged';
import type { BaseUIComponentProps } from '../../internals/types';
import {
  createChangeEventDetails,
  createGenericEventDetails,
  type BaseUIChangeEventDetails,
  type BaseUIGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useControlled } from '../../solid-utils/useControlled';
import { createRef } from '../../solid-utils/refs';
import { visuallyHidden, visuallyHiddenInput } from '../../solid-utils/visuallyHidden';
import { OTPFieldRootContext } from './OTPFieldRootContext';
import { rootStateAttributesMapping } from '../utils/stateAttributesMapping';
import {
  getOTPValidationConfig,
  normalizeOTPValue,
  normalizeOTPValueWithDetails,
  type OTPValidationType,
} from '../utils/otp';

/**
 * Groups all OTP field parts and manages their state.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI OTP Field](https://base-ui.com/react/components/otp-field)
 */
export function OTPFieldRoot(componentProps: OTPFieldRoot.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'aria-describedby',
    'aria-labelledby',
    'id',
    'autoComplete',
    'defaultValue',
    'value',
    'onValueChange',
    'onValueComplete',
    'form',
    'length',
    'autoSubmit',
    'mask',
    'inputMode',
    'validationType',
    'normalizeValue',
    'disabled',
    'readOnly',
    'required',
    'name',
    'onValueInvalid',
    'render',
    'className',
    'class',
    'style',
    'ref',
  );

  const {
    setDirty,
    validityData,
    disabled: fieldDisabled,
    setFilled,
    invalid,
    name: fieldName,
    state: fieldState,
    validation,
    validationMode,
    setFocused,
    setTouched,
  } = useFieldRootContext();
  const { clearErrors } = useFormContext();
  const { getDescriptionProps, labelId } = useLabelableContext();

  const autoComplete = () => componentProps.autoComplete ?? 'one-time-code';
  const autoSubmit = () => componentProps.autoSubmit ?? false;
  const mask = () => componentProps.mask ?? false;
  const validationType = () => componentProps.validationType ?? 'numeric';
  const readOnly = () => componentProps.readOnly ?? false;
  const required = () => componentProps.required ?? false;
  const disabled = () => Boolean(fieldDisabled() || componentProps.disabled);
  const name = () => fieldName() ?? componentProps.name;
  const length = () => componentProps.length;

  const [valueUnwrapped, setValueUnwrapped] = useControlled<string>({
    controlled: () => componentProps.value,
    default: untrack(() => componentProps.defaultValue) ?? '',
    name: 'OTPField',
    state: 'value',
  });

  const rootRef = createRef<HTMLDivElement>();
  const inputRefs: { current: Array<HTMLElement | null> } = { current: [] };
  let pendingFocus: { index: number; value: string } | null = null;
  let pendingCompleteValue: {
    value: string;
    eventDetails: OTPFieldRoot.CompleteEventDetails;
  } | null = null;
  // A read-only view over the first slot; nothing assigns through it.
  const firstInputRef: { readonly current: HTMLInputElement | null } = {
    get current() {
      return (inputRefs.current[0] as HTMLInputElement | null) ?? null;
    },
  };

  const id = useLabelableId({
    get id() {
      return componentProps.id;
    },
  });
  const ariaLabelledByProp = () => componentProps['aria-labelledby'] as string | undefined;
  const ariaLabelledBy = useAriaLabelledBy(
    ariaLabelledByProp,
    labelId,
    firstInputRef,
    () => true,
    id,
  );
  const inputAriaLabelledBy = () => (ariaLabelledByProp() == null ? ariaLabelledBy() : undefined);
  const ariaDescribedBy = () =>
    mergeAriaIds(
      componentProps['aria-describedby'] as string | undefined,
      getDescriptionProps({})['aria-describedby'] as string | undefined,
    );
  const validationConfig = () => getOTPValidationConfig(validationType());
  const pattern = () => validationConfig()?.slotPattern;
  const hiddenInputPattern = () => validationConfig()?.getRootPattern(length());
  const inputMode = () => componentProps.inputMode ?? validationConfig()?.inputMode;
  const hasValidLength = () => Number.isInteger(length()) && length() > 0;

  const value = createMemo(() =>
    normalizeOTPValue(valueUnwrapped(), length(), validationType(), componentProps.normalizeValue),
  );
  const filled = () => value() !== '';

  const [inputCount, setInputCount] = createSignal(0, { ownedWrite: true });
  const [focusedIndex, setFocusedIndex] = createSignal(
    untrack(() => Math.min(value().length, length() - 1)),
    { ownedWrite: true },
  );
  const [focused, setFocusedState] = createSignal(false, { ownedWrite: true });

  const activeIndex = () =>
    focused()
      ? Math.min(focusedIndex(), Math.max(length() - 1, 0))
      : Math.min(value().length, length() - 1);

  createEffect(
    () => filled(),
    (currentFilled) => {
      setFilled(currentFilled);
    },
  );

  /* istanbul ignore else -- `process.env.NODE_ENV` is a build-time constant under test */
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useOTPFieldRootDevWarnings({
      inputCount,
      length,
    });
  }

  useRegisterFieldControl(
    firstInputRef,
    id,
    value,
    undefined,
    () => !disabled(),
    () => componentProps.name,
  );

  function focusInput(index: number) {
    const targetIndex = Math.min(Math.max(index, 0), Math.max(inputRefs.current.length - 1, 0));
    const target = inputRefs.current[targetIndex] as HTMLInputElement | null | undefined;
    target?.focus();
    target?.select();
  }

  function queueFocusInput(index: number, nextValue: string) {
    pendingFocus = { index, value: nextValue };
  }

  function requestSubmit() {
    // The hidden validation input only renders for a valid `length`, but the slots always do,
    // so fall back to the owning form of the first slot.
    let formElement =
      validation.inputRef.current?.form ??
      (inputRefs.current[0] as HTMLInputElement | null | undefined)?.form ??
      null;

    const formProp = untrack(() => componentProps.form);
    if (formProp) {
      const associatedElement = ownerDocument(rootRef.current).getElementById(formProp);
      if (associatedElement?.tagName === 'FORM') {
        formElement = associatedElement as HTMLFormElement;
      }
    }

    if (formElement && typeof formElement.requestSubmit === 'function') {
      formElement.requestSubmit();
    }
  }

  function completeValue(completedValue: string, eventDetails: OTPFieldRoot.CompleteEventDetails) {
    componentProps.onValueComplete?.(completedValue, eventDetails);

    if (untrack(autoSubmit)) {
      requestSubmit();
    }
  }

  useValueChanged(value, () => {
    const currentValue = untrack(value);

    clearErrors(untrack(name));
    setDirty(currentValue !== untrack(validityData).initialValue);

    validation.change(currentValue);

    const currentPendingFocus = pendingFocus;

    if (currentPendingFocus != null) {
      pendingFocus = null;

      if (currentPendingFocus.value === currentValue) {
        focusInput(currentPendingFocus.index);
      }
    }

    const currentPendingCompleteValue = pendingCompleteValue;

    if (currentPendingCompleteValue != null) {
      pendingCompleteValue = null;

      if (currentPendingCompleteValue.value === currentValue) {
        completeValue(currentValue, currentPendingCompleteValue.eventDetails);
      }
    }
  });

  function setValue(nextValue: string, details: OTPFieldRoot.ChangeEventDetails): string | null {
    return untrack(() => {
      const currentLength = length();
      const currentValue = value();
      const normalizedValue = normalizeOTPValue(
        nextValue,
        currentLength,
        validationType(),
        componentProps.normalizeValue,
      );

      let completeEventDetails: OTPFieldRoot.CompleteEventDetails | null = null;
      if (
        (details.reason === REASONS.inputChange || details.reason === REASONS.inputPaste) &&
        normalizedValue.length === currentLength &&
        (currentValue.length !== currentLength || details.reason === REASONS.inputPaste)
      ) {
        completeEventDetails = createGenericEventDetails(details.reason, details.event);
      }

      if (normalizedValue === currentValue) {
        if (completeEventDetails != null) {
          completeValue(normalizedValue, completeEventDetails);
        }

        return null;
      }

      componentProps.onValueChange?.(normalizedValue, details);

      if (details.isCanceled) {
        return null;
      }

      setValueUnwrapped(normalizedValue);
      if (completeEventDetails != null) {
        pendingCompleteValue = {
          value: normalizedValue,
          eventDetails: completeEventDetails,
        };
      } else if (normalizedValue.length !== currentLength) {
        pendingCompleteValue = null;
      }

      return normalizedValue;
    });
  }

  function reportValueInvalid(invalidValue: string, details: OTPFieldRoot.InvalidEventDetails) {
    componentProps.onValueInvalid?.(invalidValue, details);
  }

  function handleInputFocus(index: number, event: FocusEvent) {
    const currentValue = untrack(value);

    if (index > currentValue.length) {
      focusInput(Math.min(currentValue.length, untrack(length) - 1));
      return;
    }

    setFocusedIndex(index);
    setFocusedState(true);
    setFocused(true);
    (event.currentTarget as HTMLInputElement).select();
  }

  function handleInputBlur(event: FocusEvent) {
    if (contains(rootRef.current, event.relatedTarget as Element | null)) {
      return;
    }

    setTouched(true);
    setFocusedState(false);
    setFocused(false);

    if (untrack(validationMode) === 'onBlur') {
      validation.commit(untrack(value));
    }
  }

  function getInputId(index: number) {
    const currentId = id();
    if (currentId == null) {
      return undefined;
    }

    return index === 0 ? currentId : `${currentId}-${index + 1}`;
  }

  const state: OTPFieldRootState = {
    get disabled() {
      return disabled();
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
      return filled();
    },
    get focused() {
      return focused();
    },
    get complete() {
      return value().length === length();
    },
    get length() {
      return length();
    },
    get readOnly() {
      return readOnly();
    },
    get required() {
      return required();
    },
    get value() {
      return value();
    },
  };

  const contextValue: OTPFieldRootContext = {
    autoComplete,
    activeIndex,
    disabled,
    form: () => componentProps.form,
    focusInput,
    queueFocusInput,
    getInputId,
    handleInputBlur,
    handleInputFocus,
    inputMode,
    inputAriaLabelledBy,
    invalid,
    length,
    mask,
    pattern,
    reportValueInvalid,
    readOnly,
    required,
    normalizeValue: () => componentProps.normalizeValue,
    setValue,
    state,
    validationType,
    value,
  };

  const hiddenInputValidationProps = createMemo(() => validation.getValidationProps(disabled()));

  return (
    <CompositeList
      elementsRef={inputRefs}
      onMapChange={(newMap) => {
        setInputCount(newMap.size);
      }}
    >
      <OTPFieldRootContext value={contextValue}>
        {(() =>
          // Called inside the providers so the slot children resolve the root
          // and composite list contexts under the correct owner.
          useRenderElement('div', componentProps, {
            ref: [componentProps.ref, rootRef],
            state,
            props: [
              {
                role: 'group',
                get 'aria-describedby'() {
                  return ariaDescribedBy();
                },
                get 'aria-labelledby'() {
                  return ariaLabelledBy();
                },
              },
              elementProps,
            ],
            stateAttributesMapping: rootStateAttributesMapping,
          }))()}
        <Show when={hasValidLength()}>
          <input
            {...hiddenInputValidationProps()}
            ref={(element: HTMLInputElement | null) => {
              validation.inputRef.current = element;
            }}
            type="text"
            id={id() && name() == null ? `${id()}-hidden-input` : undefined}
            form={componentProps.form}
            name={name()}
            value={value()}
            autocomplete={autoComplete()}
            inputmode={inputMode()}
            minlength={length()}
            maxlength={length()}
            pattern={hiddenInputPattern()}
            disabled={disabled()}
            readonly={readOnly()}
            required={required()}
            aria-hidden="true"
            tabindex={-1}
            style={name() ? visuallyHiddenInput : visuallyHidden}
            onFocus={() => {
              focusInput(0);
            }}
            onInput={(event: Event) => {
              const inputElement = event.currentTarget as HTMLInputElement;

              if (event.defaultPrevented || untrack(disabled) || untrack(readOnly)) {
                // React restores the controlled value even when the change handler bails out.
                inputElement.value = untrack(value);
                return;
              }

              const rawValue = inputElement.value;
              const [normalizedValue, didRejectCharacters] = normalizeOTPValueWithDetails(
                rawValue,
                untrack(length),
                untrack(validationType),
                untrack(() => componentProps.normalizeValue),
              );

              if (didRejectCharacters) {
                reportValueInvalid(rawValue, createGenericEventDetails(REASONS.inputChange, event));
              }

              const committedValue = setValue(
                normalizedValue,
                createChangeEventDetails(REASONS.inputChange, event),
              );

              if (committedValue != null && committedValue !== '') {
                queueFocusInput(committedValue.length - 1, committedValue);
              }

              // Restore the controlled value; when the change is accepted, the
              // reactive `value` binding re-applies the new value on flush.
              // (React relies on its controlled-input restoration instead.)
              inputElement.value = untrack(value);
            }}
          />
        </Show>
      </OTPFieldRootContext>
    </CompositeList>
  );
}

export interface OTPFieldRootProps extends Omit<
  BaseUIComponentProps<'div', OTPFieldRootState>,
  'onChange'
> {
  /**
   * The id of the first input element.
   * Subsequent inputs derive their ids from it (`{id}-2`, `{id}-3`, and so on).
   */
  id?: string | undefined;
  /**
   * The input autocomplete attribute. Applied to the first slot and hidden validation input.
   * @default 'one-time-code'
   */
  autoComplete?: string | undefined;
  /**
   * A string specifying the `form` element with which the hidden input is associated.
   * This string's value must match the id of a `form` element in the same document.
   */
  form?: string | undefined;
  /**
   * The number of OTP input slots.
   * Required so the root can clamp values, detect completion, and generate
   * consistent validation markup before all slots hydrate.
   */
  length: number;
  /**
   * Whether to submit the owning form when the OTP becomes complete.
   * @default false
   */
  autoSubmit?: boolean | undefined;
  /**
   * Whether the slot inputs should mask entered characters.
   * Pass `type` directly to individual `<OTPField.Input>` parts to use a custom
   * input type.
   * @default false
   */
  mask?: boolean | undefined;
  /**
   * The virtual keyboard hint applied to the slot inputs and hidden validation input.
   *
   * Built-in validation modes provide sensible defaults, but you can override them when needed.
   */
  inputMode?: JSX.HTMLAttributes<HTMLInputElement>['inputmode'] | undefined;
  /**
   * The type of input validation to apply to the OTP value.
   * @default 'numeric'
   */
  validationType?: OTPFieldRoot.ValidationType | undefined;
  /**
   * Function that normalizes the OTP value after whitespace and `validationType` filtering.
   * It runs whenever OTP Field normalizes a value, including initial/default values, controlled
   * values, and user edits.
   *
   * The returned value is filtered by `validationType` again, then clamped to `length`.
   * It should be idempotent because OTP Field may normalize the same value more than once while
   * handling edits, storing state, and rendering controlled or uncontrolled values. Non-idempotent
   * normalizers can compound across those normalization passes. Characters rejected while
   * normalizing typed or pasted text are reported through `onValueInvalid`.
   */
  normalizeValue?: ((value: string) => string) | undefined;
  /**
   * Whether the user must enter a value before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the user should be unable to change the field value.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * The OTP value.
   */
  value?: string | undefined;
  /**
   * The uncontrolled OTP value when the component is initially rendered.
   */
  defaultValue?: string | undefined;
  /**
   * Callback fired when the OTP value changes.
   *
   * The `eventDetails.reason` indicates what triggered the change:
   * - `'input-change'` for typing or autofill
   * - `'input-clear'` when a character is removed by text input
   * - `'input-paste'` for paste interactions
   * - `'keyboard'` for keyboard interactions that change the value
   */
  onValueChange?:
    ((value: string, eventDetails: OTPFieldRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Callback fired when entered text contains characters that are rejected by validation or
   * normalization before the OTP value updates.
   *
   * The `value` argument is the attempted user-entered string before normalization.
   */
  onValueInvalid?:
    ((value: string, eventDetails: OTPFieldRoot.InvalidEventDetails) => void) | undefined;
  /**
   * Callback function that is fired when the OTP value becomes complete, or when a complete value
   * is pasted while the OTP is already complete.
   *
   * When the value changes, it runs later than `onValueChange`, after the internal value update is
   * applied. If a complete pasted value matches the current value, `onValueChange` does not fire.
   *
   * If `autoSubmit` is enabled, it runs immediately before the owning form is submitted.
   */
  onValueComplete?:
    ((value: string, eventDetails: OTPFieldRoot.CompleteEventDetails) => void) | undefined;
}

export interface OTPFieldRootState extends FieldRootState {
  /**
   * Whether all slots are filled.
   */
  complete: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * The number of OTP input slots.
   */
  length: number;
  /**
   * Whether the user should be unable to change the field value.
   */
  readOnly: boolean;
  /**
   * Whether the user must enter a value before submitting a form.
   */
  required: boolean;
  /**
   * The OTP value.
   */
  value: string;
}

export type OTPFieldRootChangeEventReason =
  | typeof REASONS.inputChange
  | typeof REASONS.inputClear
  | typeof REASONS.inputPaste
  | typeof REASONS.keyboard;
export type OTPFieldRootChangeEventDetails =
  BaseUIChangeEventDetails<OTPFieldRoot.ChangeEventReason>;

export type OTPFieldRootInvalidEventReason = typeof REASONS.inputChange | typeof REASONS.inputPaste;
export type OTPFieldRootInvalidEventDetails =
  BaseUIGenericEventDetails<OTPFieldRoot.InvalidEventReason>;

export type OTPFieldRootCompleteEventReason =
  typeof REASONS.inputChange | typeof REASONS.inputPaste;
export type OTPFieldRootCompleteEventDetails =
  BaseUIGenericEventDetails<OTPFieldRoot.CompleteEventReason>;

export namespace OTPFieldRoot {
  export type State = OTPFieldRootState;
  export type Props = OTPFieldRootProps;
  export type ValidationType = OTPValidationType;
  export type ChangeEventReason = OTPFieldRootChangeEventReason;
  export type ChangeEventDetails = OTPFieldRootChangeEventDetails;
  export type InvalidEventReason = OTPFieldRootInvalidEventReason;
  export type InvalidEventDetails = OTPFieldRootInvalidEventDetails;
  export type CompleteEventReason = OTPFieldRootCompleteEventReason;
  export type CompleteEventDetails = OTPFieldRootCompleteEventDetails;
}

function mergeAriaIds(...values: Array<string | undefined>) {
  const ids = values.flatMap((value) => value?.split(/\s+/).filter(Boolean) ?? []);
  return ids.length > 0 ? Array.from(new Set(ids)).join(' ') : undefined;
}

interface UseOTPFieldRootDevWarningsParameters {
  inputCount: Accessor<number>;
  length: Accessor<number>;
}

function useOTPFieldRootDevWarnings(parameters: UseOTPFieldRootDevWarningsParameters) {
  createEffect(
    () => ({ inputCount: parameters.inputCount(), length: parameters.length() }),
    (current) => {
      const { inputCount, length } = current;
      if (!Number.isInteger(length) || length <= 0 || inputCount === 0 || inputCount === length) {
        return;
      }

      const message =
        '<OTPField.Root> `length` must match the number of rendered ' +
        `<OTPField.Input /> parts. Received \`length={${length}}\` but rendered ` +
        `${inputCount} input${inputCount === 1 ? '' : 's'}.`;
      warn(message);
    },
  );

  createEffect(
    () => parameters.length(),
    (length) => {
      if (Number.isInteger(length) && length > 0) {
        return;
      }

      warn(
        `<OTPField.Root> \`length\` must be a positive integer. Received \`length={${String(length)}}\`.`,
      );
    },
  );
}
