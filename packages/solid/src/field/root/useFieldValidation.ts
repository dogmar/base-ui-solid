import { EMPTY_OBJECT } from '@base-ui/utils/empty';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { mergeProps } from '../../merge-props';
import { DEFAULT_VALIDITY_STATE } from '../../internals/field-constants/constants';
import { useFormContext } from '../../internals/form-context/FormContext';
import type { Form } from '../../form';
import { getCombinedFieldValidityData } from '../utils/getCombinedFieldValidityData';
import type { HTMLProps } from '../../internals/types';
import { createRef, type RefObject } from '../../solid-utils/refs';
import { useTimeout } from '../../solid-utils/timers';
import type { FieldValidityData, FieldRootState } from './FieldRoot';

const validityKeys = Object.keys(DEFAULT_VALIDITY_STATE) as Array<keyof ValidityState>;

export type RegisteredInput = {
  controlRef: RefObject<HTMLElement>;
  value: string | undefined;
};

export type RegisteredInputs = Map<HTMLInputElement, RegisteredInput>;

/**
 * Whether an input participates in the surrounding Base UI Form. Inputs that are effectively
 * disabled, or whose `form` attribute explicitly associates them with another form, are excluded.
 * DOM position only matters when it associates the input with a different form. Otherwise, field
 * registration is context-driven, so portaled inputs (for example inside a dialog) still belong to
 * the form for both validation and values projected into `onFormSubmit`.
 */
export function isEligibleInput(input: HTMLInputElement, formElement: HTMLFormElement | null) {
  if (input.matches(':disabled')) {
    return false;
  }

  if (!formElement || input.form === formElement) {
    return true;
  }

  // Context crosses portal boundaries. An unassociated portaled input still participates in
  // contextual validation, unless an explicit `form` attribute opts it out of the surrounding Form.
  return input.form === null && !input.hasAttribute('form');
}

/**
 * Picks the input whose native validity should represent a field that owns several inputs (such as a
 * checkbox or radio group). Prefers the first eligible currently-invalid input, where "first" follows
 * registration order (mount order), and otherwise returns the first eligible input.
 */
function findRepresentativeInput(
  inputs: RegisteredInputs,
  formElement: HTMLFormElement | null,
): HTMLInputElement | null {
  let fallback: HTMLInputElement | null = null;
  for (const input of inputs.keys()) {
    if (!isEligibleInput(input, formElement)) {
      continue;
    }
    if (!input.validity.valid) {
      return input;
    }
    fallback ??= input;
  }
  return fallback;
}

function makeState(customError: boolean): Record<keyof ValidityState, boolean> {
  return { ...DEFAULT_VALIDITY_STATE, valid: !customError, customError } as Record<
    keyof ValidityState,
    boolean
  >;
}

function getNativeErrors(element: HTMLInputElement | null): string[] {
  return element && element.validationMessage ? [element.validationMessage] : [];
}

export function useFieldValidation(
  params: UseFieldValidationParameters,
): UseFieldValidationReturnValue {
  const { elementRef, formRef } = useFormContext();

  const labelableContext = useLabelableContext();
  const controlId = labelableContext.controlId;
  const getDescriptionProps = labelableContext.getDescriptionProps;

  const timeout = useTimeout();
  const inputRef = createRef<HTMLInputElement>();
  const registeredInputs: RegisteredInputs = new Map();
  let validationCommitId = 0;
  // Tracks the message installed by Base UI and the custom message it displaced.
  let customValidityRecord:
    | [element: HTMLInputElement, message: string, displaced: string]
    | null = null;

  // Groups register several inputs against a single field so focus, validation, and form-value
  // projection can use the same live controls. This also ensures a `required` checkbox can't be
  // satisfied by another input in the group, matching native per-checkbox behavior.
  const registerInput = (element: HTMLInputElement, registration: RegisteredInput) => {
    registeredInputs.set(element, registration);
    return () => {
      registeredInputs.delete(element);
    };
  };

  const getInputControl = () => {
    const element = findRepresentativeInput(registeredInputs, elementRef.current);
    return (element && registeredInputs.get(element)?.controlRef.current) || null;
  };

  const commit = async (value: unknown, revalidate = false) => {
    validationCommitId += 1;
    const currentValidationCommitId = validationCommitId;

    function updateRegisteredFieldValidity(
      nextValidityData: FieldValidityData,
      externalInvalid = params.invalid,
    ) {
      const fieldId = params.registeredFieldIdRef.current ?? controlId();
      if (fieldId == null) {
        return;
      }

      const currentFieldData = formRef.current.fields.get(fieldId);
      if (!currentFieldData) {
        return;
      }

      const validityDataWithFormErrors = getCombinedFieldValidityData(
        nextValidityData,
        externalInvalid,
      );

      formRef.current.fields.set(fieldId, {
        ...currentFieldData,
        validityData: validityDataWithFormErrors,
      });
    }

    function makeValidityData(
      validityState: Record<keyof ValidityState, boolean>,
      errorMessages: string[],
    ): FieldValidityData {
      // `valueMissing` may be suppressed while the native message remains non-empty.
      const errors = validityState.valid === false ? errorMessages : [];
      return {
        value,
        state: validityState,
        error: errors[0] ?? '',
        errors,
        initialValue: params.validityData.initialValue,
      };
    }

    function setCustomValidity(element: HTMLInputElement, message: string) {
      // Never reinstall a native constraint message as custom validity.
      const displaced = element.validity.customError ? element.validationMessage : '';
      const ownedMessage = message.replace(/\r\n?/g, '\n');
      element.setCustomValidity(ownedMessage);
      customValidityRecord = [element, ownedMessage, displaced];
    }

    function clearCustomValidity() {
      const record = customValidityRecord;
      customValidityRecord = null;
      // Replacement transfers ownership; barred controls hide `validationMessage`.
      if (record && (!record[0].willValidate || record[0].validationMessage === record[1])) {
        record[0].setCustomValidity(record[2]);
      }
    }

    function publish(
      validityState: Record<keyof ValidityState, boolean>,
      errorMessages: string[],
      externalInvalid?: boolean,
    ) {
      const nextValidityData = makeValidityData(validityState, errorMessages);
      updateRegisteredFieldValidity(nextValidityData, externalInvalid);
      params.setValidityData(nextValidityData);
    }

    function getState(el: HTMLInputElement) {
      const computedState = validityKeys.reduce(
        (acc, key) => {
          acc[key] = el.validity[key];
          return acc;
        },
        {} as Record<keyof ValidityState, boolean>,
      );

      let hasOnlyValueMissingError = false;

      for (const key of validityKeys) {
        if (key === 'valid') {
          continue;
        }
        if (key === 'valueMissing' && computedState[key]) {
          hasOnlyValueMissingError = true;
        } else if (computedState[key]) {
          return computedState;
        }
      }

      // Only make `valueMissing` mark the field invalid if it's been changed
      // to reduce error noise.
      if (hasOnlyValueMissingError && !params.markedDirtyRef.current) {
        computedState.valid = true;
        computedState.valueMissing = false;
      }
      return computedState;
    }

    // A field can own several inputs (such as a checkbox or radio group), but only the last-mounted
    // one wins the shared `inputRef`. Validate against the registry instead so every input counts;
    // `inputRef` is the fallback only when no inputs are registered.
    function resolveRepresentativeInput() {
      return registeredInputs.size > 0
        ? findRepresentativeInput(registeredInputs, elementRef.current)
        : inputRef.current;
    }

    // A field with no eligible input has no native constraint, but its custom validator still
    // applies to the logical value at the configured validation boundary.
    let element = resolveRepresentativeInput();

    function refreshState() {
      element = resolveRepresentativeInput();
      // Barred controls expose no usable native constraint state.
      return element?.willValidate ? getState(element) : makeState(false);
    }

    if (revalidate) {
      if (params.state.valid !== false || !element) {
        return;
      }

      if (!element.validity.valueMissing) {
        // The 'valueMissing' (required) condition has been resolved by the user typing.
        // Temporarily mark the field as valid for this onChange event.
        // Other native errors (e.g., typeMismatch) will be caught by full validation on blur or submit.
        // The required value is now present; ignore stale external invalid state for this pass.
        clearCustomValidity();
        // Clearing can make another registered input with a custom error representative.
        const currentElement = resolveRepresentativeInput();
        const foreign = currentElement?.validity.customError ? getNativeErrors(currentElement) : [];
        publish(makeState(foreign.length > 0), foreign, false);
        return;
      }

      // A stale custom error can coexist with valueMissing, but defer any other native errors.
      for (const key of validityKeys) {
        if (
          key !== 'valid' &&
          key !== 'valueMissing' &&
          key !== 'customError' &&
          element.validity[key]
        ) {
          return;
        }
      }

      // Value is still missing: publish the current native state so valueMissing and the changed
      // value are observable immediately. Full custom validation still waits for its boundary.
    }

    timeout.clear();

    // Do not read Base UI's previous message back as a native constraint.
    clearCustomValidity();

    let nextState = refreshState();
    let validationErrors = getNativeErrors(element);

    const isValidatingOnChange = params.shouldValidateOnChange();

    // Native or externally set errors take precedence outside onChange validation.
    if (validationErrors.length === 0 || isValidatingOnChange) {
      // call the validate function because either
      // - validating on change, or
      // - native constraint validations passed, custom validity check is next
      const formValues = Array.from(formRef.current.fields.values()).reduce((acc, field) => {
        if (field.name) {
          acc[field.name] = field.getValue();
        }
        return acc;
      }, {} as Form.Values);

      const resultOrPromise = params.validate(value, formValues);
      let result: string | string[] | null | void;

      if (
        typeof resultOrPromise === 'object' &&
        resultOrPromise !== null &&
        'then' in resultOrPromise
      ) {
        // Retire a previous async result before an onSubmit validation begins.
        if (params.validationMode === 'onSubmit') {
          publish(nextState, validationErrors);
        }

        // A rejected validator keeps the previously published state, so a transient
        // failure can't retire an error and unblock submission.
        result = await resultOrPromise;

        if (currentValidationCommitId !== validationCommitId) {
          return;
        }
        nextState = refreshState();
      } else {
        result = resultOrPromise;
      }

      // Empty results and empty array entries are valid.
      validationErrors = result ? ([] as string[]).concat(result).filter(Boolean) : [];

      if (validationErrors.length > 0) {
        nextState.valid = false;
        nextState.customError = true;
        // Keep custom errors for barred controls in field state only.
        if (element?.willValidate) {
          setCustomValidity(element, validationErrors.join('\n'));
        }
      } else {
        validationErrors = getNativeErrors(element);
      }
    }

    publish(nextState, validationErrors);
  };

  const change = (value: unknown, cancelPending = false) => {
    timeout.clear();
    validationCommitId += 1;
    if (cancelPending) {
      return;
    }

    const validateOnChange = params.shouldValidateOnChange();

    if (validateOnChange && value !== '' && params.validationDebounceTime) {
      timeout.start(params.validationDebounceTime, () => {
        commit(value);
      });
    } else {
      commit(value, !validateOnChange);
    }
  };

  const getValidationProps = (disabled: boolean, externalProps: HTMLProps = {}) =>
    mergeProps(
      getDescriptionProps(externalProps),
      params.state.valid === false && !params.state.disabled && !disabled
        ? // Solid renders boolean attribute values as presence/absence; `aria-invalid`
          // needs an explicit string.
          { 'aria-invalid': 'true' }
        : (EMPTY_OBJECT as HTMLProps),
    );

  return {
    getValidationProps,
    inputRef,
    registeredInputs,
    registerInput,
    getInputControl,
    commit,
    change,
  };
}

export interface UseFieldValidationParameters {
  setValidityData: (
    data: FieldValidityData | ((prev: FieldValidityData) => FieldValidityData),
  ) => void;
  validate: (
    value: unknown,
    formValues: Form.Values,
  ) => string | string[] | null | void | Promise<string | string[] | null | void>;
  /**
   * Reactive when provided through a getter.
   */
  validityData: FieldValidityData;
  /**
   * Reactive when provided through a getter.
   */
  validationDebounceTime: number;
  /**
   * Reactive when provided through a getter.
   */
  invalid: boolean;
  markedDirtyRef: { current: boolean };
  state: FieldRootState;
  shouldValidateOnChange: () => boolean;
  /**
   * Reactive when provided through a getter.
   */
  validationMode: Form.ValidationMode;
  registeredFieldIdRef: { current: string | undefined };
}

export interface UseFieldValidationReturnValue {
  getValidationProps: (disabled: boolean, props?: HTMLProps) => HTMLProps;
  inputRef: RefObject<HTMLInputElement>;
  registeredInputs: RegisteredInputs;
  registerInput: (element: HTMLInputElement, registration: RegisteredInput) => void | (() => void);
  getInputControl: () => HTMLElement | null;
  commit: (value: unknown) => Promise<void>;
  change: (value: unknown, cancelPending?: boolean) => void;
}
