import { createEffect, omit, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { EMPTY_ARRAY } from '@base-ui/utils/empty';
import { areArraysEqual } from '@base-ui/utils/areArraysEqual';
import { useControlled } from '../solid-utils/useControlled';
import { useBaseUiId } from '../internals/useBaseUiId';
import { useRenderElement } from '../internals/useRenderElement';
import { CheckboxGroupContext } from './CheckboxGroupContext';
import type { FieldRootState } from '../field/root/FieldRoot';
import { isEligibleInput } from '../field/root/useFieldValidation';
import { useFieldRootContext } from '../internals/field-root-context/FieldRootContext';
import { useRegisterFieldControl } from '../internals/field-register-control/useRegisterFieldControl';
import { useLabelableContext } from '../internals/labelable-provider/LabelableContext';
import { useLabelableId } from '../internals/labelable-provider/useLabelableId';
import type { BaseUIComponentProps } from '../internals/types';
import { fieldValidityMapping } from '../internals/field-constants/constants';
import { useCheckboxGroupParent } from './useCheckboxGroupParent';
import type { BaseUIChangeEventDetails } from '../internals/createBaseUIEventDetails';
import { REASONS } from '../internals/reasons';
import { useFormContext } from '../internals/form-context/FormContext';
import { useValueChanged } from '../internals/useValueChanged';

/**
 * Provides a shared state to a series of checkboxes.
 *
 * Documentation: [Base UI Checkbox Group](https://base-ui.com/react/components/checkbox-group)
 */
export function CheckboxGroup(componentProps: CheckboxGroup.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'allValues',
    'className',
    'class',
    'defaultValue',
    'disabled',
    'id',
    'onValueChange',
    'render',
    'value',
    'style',
    'ref',
  );

  const {
    disabled: fieldDisabled,
    name: fieldName,
    state: fieldState,
    validation,
    setFilled,
    setDirty,
    validityData,
  } = useFieldRootContext();
  const { labelId, registerControlId, getDescriptionProps } = useLabelableContext();
  const { clearErrors, elementRef } = useFormContext();

  const disabled = () => Boolean(fieldDisabled() || componentProps.disabled);

  const [value, setValueUnwrapped] = useControlled({
    controlled: () => componentProps.value,
    default: untrack(() => componentProps.defaultValue) ?? (EMPTY_ARRAY as string[]),
    name: 'CheckboxGroup',
    state: 'value',
  });

  const setValue = (v: string[], eventDetails: CheckboxGroup.ChangeEventDetails) => {
    componentProps.onValueChange?.(v, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setValueUnwrapped(v);
  };

  const parent = useCheckboxGroupParent({
    get allValues() {
      return componentProps.allValues;
    },
    get value() {
      return value();
    },
    onValueChange: setValue,
  });

  // The group is the field's control and takes its name from `aria-labelledby`, so `Field.Label`
  // must not point `htmlFor` (rendered as `for`) at one arbitrary checkbox inside the group.
  useLabelableId({ id: null });

  const id = useBaseUiId(() =>
    typeof componentProps.id === 'string' ? componentProps.id : undefined,
  );
  const getInputControl = validation.getInputControl;

  const controlRef = {
    get current() {
      return getInputControl();
    },
  };

  const getFormValue = () => {
    const currentValue = untrack(value);
    const formElement = elementRef.current;
    if (!formElement) {
      return currentValue;
    }

    const successfulValues = new Set<string>();
    for (const [input, registration] of validation.registeredInputs) {
      if (
        registration.value !== undefined &&
        input.checked &&
        isEligibleInput(input, formElement)
      ) {
        successfulValues.add(registration.value);
      }
    }

    return currentValue.filter((inputValue) => successfulValues.has(inputValue));
  };

  useRegisterFieldControl(
    controlRef,
    id,
    value,
    getFormValue,
    () => !!fieldName() && !disabled(),
    fieldName,
  );

  createEffect(
    () => value(),
    (currentValue) => {
      setFilled(currentValue.length > 0);
    },
  );

  useValueChanged(value, () => {
    const currentFieldName = untrack(fieldName);
    if (currentFieldName) {
      clearErrors(currentFieldName);
    }

    const initialValue = Array.isArray(untrack(validityData).initialValue)
      ? (untrack(validityData).initialValue as readonly string[])
      : (EMPTY_ARRAY as readonly string[]);

    setDirty(!areArraysEqual(untrack(value), initialValue));

    validation.change(untrack(value));
  });

  const state: CheckboxGroupState = {
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
    get disabled() {
      return disabled();
    },
  };

  const contextValue: CheckboxGroupContext = {
    allValues: () => componentProps.allValues,
    value,
    setValue,
    parent,
    disabled,
    validation,
    registerControlId,
  };

  return (
    <CheckboxGroupContext value={contextValue}>
      {useRenderElement('div', componentProps, {
        state,
        ref: componentProps.ref,
        props: [
          {
            get id() {
              return componentProps.id;
            },
            role: 'group',
            get 'aria-labelledby'() {
              return labelId();
            },
          },
          elementProps,
          getDescriptionProps,
        ],
        stateAttributesMapping: fieldValidityMapping,
      })}
    </CheckboxGroupContext>
  );
}

export interface CheckboxGroupState extends FieldRootState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface CheckboxGroupProps extends BaseUIComponentProps<'div', CheckboxGroupState> {
  /**
   * Names of the checkboxes in the group that should be ticked.
   *
   * To render an uncontrolled checkbox group, use the `defaultValue` prop instead.
   */
  value?: string[] | undefined;
  /**
   * Names of the checkboxes in the group that should be initially ticked.
   *
   * To render a controlled checkbox group, use the `value` prop instead.
   */
  defaultValue?: string[] | undefined;
  /**
   * Event handler called when a checkbox in the group is ticked or unticked.
   * Provides the new value as an argument.
   */
  onValueChange?:
    ((value: string[], eventDetails: CheckboxGroupChangeEventDetails) => void) | undefined;
  /**
   * Names of all checkboxes in the group. Use this when creating a parent checkbox.
   */
  allValues?: string[] | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export type CheckboxGroupChangeEventReason = typeof REASONS.none;
export type CheckboxGroupChangeEventDetails =
  BaseUIChangeEventDetails<CheckboxGroup.ChangeEventReason>;

export namespace CheckboxGroup {
  export type State = CheckboxGroupState;
  export type Props = CheckboxGroupProps;
  export type ChangeEventReason = CheckboxGroupChangeEventReason;
  export type ChangeEventDetails = CheckboxGroupChangeEventDetails;
}
