import { createRenderEffect, createSignal, onCleanup, omit, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { FieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import {
  DEFAULT_VALIDITY_STATE,
  fieldValidityMapping,
} from '../../internals/field-constants/constants';
import { useFieldsetRootContext } from '../../fieldset/root/FieldsetRootContext';
import type { Form } from '../../form';
import { useFormContext } from '../../internals/form-context/FormContext';
import { LabelableProvider } from '../../internals/labelable-provider';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { applyRef, type RefInput } from '../../solid-utils/refs';
import { useFieldValidation } from './useFieldValidation';
import { useFieldControlRegistration } from '../../internals/field-register-control/useFieldControlRegistration';

/**
 * @internal
 */
function FieldRootInner(componentProps: FieldRoot.Props): JSX.Element {
  const { errors, validationMode: formValidationMode, submitCountRef } = useFormContext();

  const elementProps = omit(
    componentProps,
    'render',
    'className',
    'class',
    'validate',
    'validationDebounceTime',
    'validationMode',
    'name',
    'disabled',
    'invalid',
    'dirty',
    'touched',
    'actionsRef',
    'style',
    'ref',
  );

  const validationDebounceTime = () => componentProps.validationDebounceTime ?? 0;
  const validationMode = () => componentProps.validationMode ?? formValidationMode();
  const name = () => componentProps.name;

  const fieldsetContext = useFieldsetRootContext(true);
  const disabledFieldset = () => fieldsetContext?.disabled();

  const validate: NonNullable<FieldRoot.Props['validate']> = (value, formValues) =>
    (componentProps.validate ?? (() => null))(value, formValues);

  const disabled = () => (disabledFieldset() || componentProps.disabled) ?? false;

  const [touchedState, setTouchedUnwrapped] = createSignal(false, { ownedWrite: true });
  const [dirtyState, setDirtyUnwrapped] = createSignal(false, { ownedWrite: true });
  const [filled, setFilled] = createSignal(false, { ownedWrite: true });
  const [focused, setFocused] = createSignal(false, { ownedWrite: true });

  const dirty = () => componentProps.dirty ?? dirtyState();
  const touched = () => componentProps.touched ?? touchedState();

  const markedDirtyRef = { current: untrack(dirty) };
  const registeredFieldIdRef: { current: string | undefined } = { current: undefined };
  const [registeredFieldName, setRegisteredFieldName] = createSignal<string | undefined>(
    undefined,
    { ownedWrite: true },
  );
  const effectiveName = () => name() ?? registeredFieldName();

  createRenderEffect(
    () => componentProps.dirty,
    (dirtyProp) => {
      if (dirtyProp !== undefined) {
        markedDirtyRef.current = dirtyProp;
      }
    },
  );

  const setDirty = (value: boolean) => {
    if (untrack(() => componentProps.dirty) !== undefined) {
      return;
    }

    if (value) {
      markedDirtyRef.current = true;
    }
    setDirtyUnwrapped(value);
  };

  const setTouched = (value: boolean) => {
    if (untrack(() => componentProps.touched) !== undefined) {
      return;
    }
    setTouchedUnwrapped(value);
  };

  const shouldValidateOnChange = () => {
    const mode = untrack(validationMode);
    return mode === 'onChange' || (mode === 'onSubmit' && submitCountRef.current > 0);
  };

  const formError = () => {
    const currentName = effectiveName();
    return currentName && Object.hasOwn(errors(), currentName) ? errors()[currentName] : null;
  };
  const hasFormError = () => {
    const currentFormError = formError();
    return !!(Array.isArray(currentFormError) ? currentFormError.length : currentFormError);
  };
  const invalid = () => componentProps.invalid === true || hasFormError();

  const [validityData, setValidityData] = createSignal<FieldValidityData>(
    {
      state: DEFAULT_VALIDITY_STATE,
      error: '',
      errors: [],
      value: null,
      initialValue: null,
    },
    { ownedWrite: true },
  );

  // App-controlled invalidity (the `invalid` prop and `<Form>` errors) keeps the field marked
  // invalid even while disabled. Only computed validity (native constraints and `validate`)
  // is suppressed when disabled, matching `:disabled` not participating in constraint validation.
  const valid = () => !invalid() && (disabled() ? null : validityData().state.valid);

  const state: FieldRootState = {
    get disabled() {
      return disabled();
    },
    get touched() {
      return touched();
    },
    get dirty() {
      return dirty();
    },
    get valid() {
      return valid();
    },
    get filled() {
      return filled();
    },
    get focused() {
      return focused();
    },
  };

  const validation = useFieldValidation({
    setValidityData,
    validate,
    get validityData() {
      return validityData();
    },
    get validationDebounceTime() {
      return validationDebounceTime();
    },
    get invalid() {
      return invalid();
    },
    markedDirtyRef,
    state,
    shouldValidateOnChange,
    get validationMode() {
      return validationMode();
    },
    registeredFieldIdRef,
  });

  const [validateFieldControl, registerFieldControl] = useFieldControlRegistration({
    change: validation.change,
    commit: validation.commit,
    get invalid() {
      return invalid();
    },
    markedDirtyRef,
    get name() {
      return name();
    },
    setRegisteredFieldName,
    registeredFieldIdRef,
    setValidityData,
    get validityData() {
      return validityData();
    },
  });

  const actions: FieldRootActions = { validate: validateFieldControl };
  createRenderEffect(
    () => componentProps.actionsRef,
    (actionsRef) => {
      if (!actionsRef) {
        return undefined;
      }
      applyRef(actionsRef, actions);
      return () => {
        applyRef(actionsRef, null);
      };
    },
  );
  onCleanup(() => {
    applyRef(untrack(() => componentProps.actionsRef), null);
  });

  const contextValue: FieldRootContext = {
    invalid,
    name: effectiveName,
    validityData,
    setValidityData,
    disabled,
    setTouched,
    setDirty,
    setFilled,
    setFocused,
    validationMode,
    shouldValidateOnChange,
    state,
    registerFieldControl,
    validation,
  };

  return (
    <FieldRootContext value={contextValue}>
      {useRenderElement('div', componentProps, {
        ref: componentProps.ref,
        state,
        props: [elementProps],
        stateAttributesMapping: fieldValidityMapping,
      })}
    </FieldRootContext>
  );
}

/**
 * Groups all parts of the field.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export function FieldRoot(componentProps: FieldRoot.Props): JSX.Element {
  return (
    <LabelableProvider>
      <FieldRootInner {...componentProps} />
    </LabelableProvider>
  );
}

export interface FieldValidityData {
  state: {
    badInput: boolean;
    customError: boolean;
    patternMismatch: boolean;
    rangeOverflow: boolean;
    rangeUnderflow: boolean;
    stepMismatch: boolean;
    tooLong: boolean;
    tooShort: boolean;
    typeMismatch: boolean;
    valueMissing: boolean;
    valid: boolean | null;
  };
  error: string;
  errors: string[];
  value: unknown;
  initialValue: unknown;
}

export interface FieldRootActions {
  validate: () => void;
}

export interface FieldRootState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the field has been touched.
   */
  touched: boolean;
  /**
   * Whether the field value has changed from its initial value.
   */
  dirty: boolean;
  /**
   * Whether the field is valid.
   */
  valid: boolean | null;
  /**
   * Whether the field has a value.
   */
  filled: boolean;
  /**
   * Whether the field is focused.
   */
  focused: boolean;
}

export interface FieldRootProps extends BaseUIComponentProps<'div', FieldRootState> {
  /**
   * Whether the component should ignore user interaction.
   * Takes precedence over the `disabled` prop on the `<Field.Control>` component.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Identifies the field when a form is submitted.
   * Takes precedence over the `name` prop on the `<Field.Control>` component.
   */
  name?: string | undefined;
  /**
   * A function for custom validation. Return a string or an array of strings with
   * the error message(s) if the value is invalid. Returning nothing, `null`, an empty
   * string, or an empty array means the value is valid.
   * Asynchronous functions are supported, but they do not prevent form submission
   * when using `validationMode="onSubmit"`.
   */
  validate?:
    | ((
        value: unknown,
        formValues: Form.Values,
      ) => string | string[] | null | void | Promise<string | string[] | null | void>)
    | undefined;
  /**
   * Determines when the field should be validated.
   * This takes precedence over the `validationMode` prop on `<Form>`.
   *
   * - `onSubmit`: triggers validation when the form is submitted, and re-validates on change after submission.
   * - `onBlur`: triggers validation when the control loses focus.
   * - `onChange`: triggers validation on every change to the control value.
   *
   * @default 'onSubmit'
   */
  validationMode?: Form.ValidationMode | undefined;
  /**
   * How long to wait between `validate` callbacks if
   * `validationMode="onChange"` is used. Specified in milliseconds.
   * @default 0
   */
  validationDebounceTime?: number | undefined;
  /**
   * Whether the field is invalid.
   * Useful when the field state is controlled by an external library.
   */
  invalid?: boolean | undefined;
  /**
   * Whether the field's value has been changed from its initial value.
   * Useful when the field state is controlled by an external library.
   */
  dirty?: boolean | undefined;
  /**
   * Whether the field has been touched.
   * Useful when the field state is controlled by an external library.
   */
  touched?: boolean | undefined;
  /**
   * A ref to imperative actions.
   * - `validate`: Validates the field when called.
   */
  actionsRef?: RefInput<FieldRoot.Actions> | undefined;
}

export namespace FieldRoot {
  export type State = FieldRootState;
  export type Props = FieldRootProps;
  export type Actions = FieldRootActions;
}
