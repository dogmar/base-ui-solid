import { createEffect, createRenderEffect, omit, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { ownerDocument } from '@base-ui/utils/owner';
import { activeElement } from '@base-ui/utils/shadowDom';
import { type FieldRootState } from '../root/FieldRoot';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { useRegisterFieldControl } from '../../internals/field-register-control/useRegisterFieldControl';
import { useFormContext } from '../../internals/form-context/FormContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useValueChanged } from '../../internals/useValueChanged';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { useControlled } from '../../solid-utils/useControlled';
import { createRef } from '../../solid-utils/refs';
import { useTimeout } from '../../solid-utils/timers';

/**
 * The form control to label and validate.
 * Renders an `<input>` element.
 *
 * You can omit this part and use any Base UI input component instead. For example,
 * [Input](https://base-ui.com/react/components/input), [Checkbox](https://base-ui.com/react/components/checkbox),
 * or [Select](https://base-ui.com/react/components/select), among others, will work with Field out of the box.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export function FieldControl(componentProps: FieldControl.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'className',
    'class',
    'id',
    'name',
    'value',
    'disabled',
    'onValueChange',
    'defaultValue',
    'autofocus',
    'style',
    'ref',
  );

  const {
    state: fieldState,
    name: fieldName,
    disabled: fieldDisabled,
    setTouched,
    setDirty,
    validityData,
    setFocused,
    setFilled,
    validationMode,
    validation,
  } = useFieldRootContext();
  const { clearErrors, elementRef: formElementRef, submitCountRef } = useFormContext();

  const nameProp = () =>
    typeof componentProps.name === 'string' ? componentProps.name : undefined;
  const idProp = () => (typeof componentProps.id === 'string' ? componentProps.id : undefined);

  const disabled = () => Boolean(fieldDisabled() || componentProps.disabled);
  const name = () => fieldName() ?? nameProp();
  const autofocus = () => componentProps.autofocus === true || componentProps.autofocus === '';

  const state: FieldControlState = {
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

  const labelableContext = useLabelableContext();
  const labelId = labelableContext.labelId;

  const id = useLabelableId({
    get id() {
      return idProp();
    },
  });

  const [valueUnwrapped] = useControlled({
    controlled: () => componentProps.value,
    default: untrack(() => componentProps.defaultValue) as
      | FieldControl.Props['defaultValue']
      | undefined,
    name: 'FieldControl',
    state: 'value',
  });

  const isControlled = () => componentProps.value !== undefined;
  const value = () => (isControlled() ? valueUnwrapped() : undefined);
  // The DOM value is always a string, so dirty comparisons must serialize the controlled value.
  const serializedValue = () => {
    const currentValue = value();
    return currentValue == null ? undefined : String(currentValue);
  };

  const getValueFromInput = () => validation.inputRef.current?.value;

  useRegisterFieldControl(
    validation.inputRef,
    id,
    serializedValue,
    getValueFromInput,
    () => !disabled(),
    nameProp,
  );

  // A post-render effect (rather than a render effect) so the input ref is
  // populated when the initial value is inspected, matching the React
  // layout-effect timing relative to DOM availability.
  createEffect(
    () => serializedValue(),
    (currentSerializedValue) => {
      const currentValue = currentSerializedValue ?? validation.inputRef.current?.value;
      if (currentValue !== undefined) {
        setFilled(currentValue !== '');
      }
    },
  );

  useValueChanged(serializedValue, () => {
    const currentSerializedValue = untrack(serializedValue);
    if (currentSerializedValue === undefined) {
      return;
    }

    clearErrors(untrack(name));
    setDirty(currentSerializedValue !== (untrack(validityData).initialValue ?? ''));

    validation.change(currentSerializedValue);
  });

  const inputRef = createRef<HTMLElement>();
  const enterValidationTimeout = useTimeout();

  createRenderEffect(
    () => autofocus(),
    (shouldAutoFocus) => {
      if (shouldAutoFocus && inputRef.current === activeElement(ownerDocument(inputRef.current))) {
        setFocused(true);
      }
    },
  );

  const initialDefaultValue = untrack(() => componentProps.defaultValue);
  const controlledInitially = untrack(isControlled);

  const defaultProps: Record<string, any> = {
    get id() {
      return id();
    },
    get disabled() {
      return disabled();
    },
    get name() {
      return name();
    },
    ref(element: HTMLInputElement | null) {
      validation.inputRef.current = element;
      // `defaultValue` semantics: applied once when the element attaches, then
      // owned by the DOM. An uncontrolled input carries no reactive `value`
      // binding at all, so prop recomputes cannot wipe user-typed text.
      if (
        element &&
        !controlledInitially &&
        initialDefaultValue !== undefined &&
        element.value === ''
      ) {
        element.value = Array.isArray(initialDefaultValue)
          ? initialDefaultValue.join(',')
          : String(initialDefaultValue);
      }
    },
    get 'aria-labelledby'() {
      return labelId();
    },
    get autofocus() {
      return autofocus();
    },
  };

  if (controlledInitially) {
    Object.defineProperty(defaultProps, 'value', {
      enumerable: true,
      configurable: true,
      get() {
        return value() as JSX.InputHTMLAttributes<HTMLInputElement>['value'];
      },
    });
  }

  return useRenderElement('input', componentProps, {
    ref: [componentProps.ref, inputRef],
    state,
    props: [
      defaultProps,
      {
        onInput(event: Event) {
          const inputElement = event.currentTarget as HTMLInputElement;
          const inputValue = inputElement.value;
          const details = createChangeEventDetails(REASONS.none, event);
          componentProps.onValueChange?.(inputValue, details);

          // Controlled values sync from the `value` prop instead, so that a value the consumer
          // rejects or rewrites never reaches the field state.
          if (untrack(isControlled)) {
            return;
          }

          // `validation.change` reads `markedDirtyRef`, so update dirty before validating.
          setDirty(inputValue !== (untrack(validityData).initialValue ?? ''));
          setFilled(inputValue !== '');

          if (!event.defaultPrevented && !details.isCanceled) {
            clearErrors(untrack(name));
            validation.change(inputValue);
          }
        },
        onFocus() {
          setFocused(true);
        },
        onBlur(event: FocusEvent) {
          setTouched(true);
          setFocused(false);

          if (untrack(validationMode) === 'onBlur') {
            const inputValue = (event.currentTarget as HTMLInputElement).value;
            validation.commit(inputValue);

            if (untrack(isControlled)) {
              // Controlled blur handlers can normalize the value before this microtask runs.
              // A rewrite back to the initial value is a programmatic reset: the field looks
              // pristine, so committing it would only surface `valueMissing` noise.
              queueMicrotask(() => {
                const nextValue = validation.inputRef.current?.value;
                if (
                  nextValue !== undefined &&
                  nextValue !== inputValue &&
                  nextValue !== (untrack(validityData).initialValue ?? '')
                ) {
                  validation.commit(nextValue);
                }
              });
            }
          }
        },
        onKeyDown(event: KeyboardEvent) {
          const currentTarget = event.currentTarget as HTMLInputElement;
          if (currentTarget.tagName === 'INPUT' && event.key === 'Enter') {
            setTouched(true);
            const currentValue = currentTarget.value;
            const form = currentTarget.form;
            if (form && form === formElementRef.current && !event.defaultPrevented) {
              const input = currentTarget;
              const submitCount = submitCountRef.current;

              // Implicit submission runs after keydown. Fall back unless Form handles it first.
              enterValidationTimeout.start(0, () => {
                if (submitCountRef.current === submitCount) {
                  validation.commit(input.value);
                }
              });
            } else {
              validation.commit(currentValue);
            }
          }
        },
      },
      elementProps,
      (props: any) => validation.getValidationProps(disabled(), props),
    ],
    stateAttributesMapping: fieldValidityMapping,
  });
}

export interface FieldControlState extends FieldRootState {}

export interface FieldControlProps extends BaseUIComponentProps<'input', FieldControlState> {
  /**
   * Callback fired when the `value` changes. Use when controlled.
   */
  onValueChange?:
    | ((value: string, eventDetails: FieldControl.ChangeEventDetails) => void)
    | undefined;
  defaultValue?: string | number | string[] | undefined;
}

export type FieldControlChangeEventReason = typeof REASONS.none;

export type FieldControlChangeEventDetails =
  BaseUIChangeEventDetails<FieldControl.ChangeEventReason>;

export namespace FieldControl {
  export type State = FieldControlState;
  export type Props = FieldControlProps;
  export type ChangeEventReason = FieldControlChangeEventReason;
  export type ChangeEventDetails = FieldControlChangeEventDetails;
}
