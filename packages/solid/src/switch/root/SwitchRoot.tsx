import { createEffect, createMemo, omit, onCleanup, untrack, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useControlled } from '../../solid-utils/useControlled';
import { applyRef, createRef, type RefInput } from '../../solid-utils/refs';
import { visuallyHidden, visuallyHiddenInput } from '../../solid-utils/visuallyHidden';
import { useRenderElement } from '../../internals/useRenderElement';
import type { BaseUIComponentProps, NonNativeButtonProps } from '../../internals/types';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { useButton } from '../../internals/use-button';
import { SwitchRootContext } from './SwitchRootContext';
import { stateAttributesMapping } from '../stateAttributesMapping';
import { dispatchClickWithModifiers } from '../../utils/dispatchClickWithModifiers';
import type { FieldRootState } from '../../field/root/FieldRoot';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { useRegisterFieldControl } from '../../internals/field-register-control/useRegisterFieldControl';
import { useFormContext } from '../../internals/form-context/FormContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useAriaLabelledBy } from '../../internals/labelable-provider/useAriaLabelledBy';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import {
  createChangeEventDetails,
  type BaseUIChangeEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useValueChanged } from '../../internals/useValueChanged';

/**
 * Represents the switch itself.
 * Renders a `<span>` element and a hidden `<input>` beside.
 *
 * Documentation: [Base UI Switch](https://base-ui.com/react/components/switch)
 */
export function SwitchRoot(componentProps: SwitchRoot.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'checked',
    'className',
    'class',
    'defaultChecked',
    'aria-labelledby',
    'form',
    'id',
    'inputRef',
    'name',
    'nativeButton',
    'onCheckedChange',
    'readOnly',
    'required',
    'disabled',
    'render',
    'uncheckedValue',
    'value',
    'style',
    'ref',
  );

  const { clearErrors } = useFormContext();
  const {
    state: fieldState,
    setTouched,
    setDirty,
    validityData,
    setFilled,
    setFocused,
    validationMode,
    disabled: fieldDisabled,
    name: fieldName,
    validation,
  } = useFieldRootContext();
  const { labelId } = useLabelableContext();

  const readOnly = () => componentProps.readOnly ?? false;
  const required = () => componentProps.required ?? false;
  const nativeButton = () => componentProps.nativeButton ?? false;
  const disabled = () => Boolean(fieldDisabled() || componentProps.disabled);
  const name = () => fieldName() ?? componentProps.name;

  const inputRef = createRef<HTMLInputElement>();
  // The click that toggles the hidden input; its `change` handler reports this
  // event (with modifier state) to match React's `onChange` nativeEvent.
  let lastInputClickEvent: MouseEvent | null = null;
  const handleInputRef = (element: HTMLInputElement | null) => {
    inputRef.current = element;
    applyRef(
      untrack(() => componentProps.inputRef),
      element,
    );
    validation.inputRef.current = element;
    syncInputValueAttribute(
      element,
      untrack(() => componentProps.value),
    );
  };
  onCleanup(() => {
    handleInputRef(null);
  });

  const switchRef = createRef<HTMLElement>();

  const id = useBaseUiId();

  const controlId = useLabelableId({
    get id() {
      return typeof componentProps.id === 'string' ? componentProps.id : undefined;
    },
  });
  const hiddenInputId = () => (nativeButton() ? undefined : controlId());

  const [checked, setCheckedState] = useControlled({
    controlled: () => componentProps.checked,
    default: Boolean(untrack(() => componentProps.defaultChecked)),
    name: 'Switch',
    state: 'checked',
  });

  useRegisterFieldControl(
    switchRef,
    id,
    checked,
    undefined,
    () => !disabled(),
    () => componentProps.name,
  );

  createEffect(
    () => checked(),
    (currentChecked) => {
      setFilled(currentChecked);
    },
  );

  useValueChanged(checked, () => {
    clearErrors(untrack(name));
    setDirty(untrack(checked) !== untrack(validityData).initialValue);

    validation.change(untrack(checked));
  });

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return disabled();
    },
    get native() {
      return nativeButton();
    },
  });
  const ariaLabelledBy = useAriaLabelledBy(
    () => {
      const ariaLabelledByProp = componentProps['aria-labelledby'];
      return typeof ariaLabelledByProp === 'string' ? ariaLabelledByProp : undefined;
    },
    labelId,
    inputRef,
    () => !nativeButton(),
    hiddenInputId,
  );

  const rootProps = {
    get id() {
      return nativeButton() ? controlId() : id();
    },
    role: 'switch',
    get 'aria-checked'() {
      // Solid renders boolean attribute values as presence/absence; aria
      // attributes need explicit strings.
      return checked() ? 'true' : 'false';
    },
    get 'aria-readonly'() {
      return readOnly() ? 'true' : undefined;
    },
    get 'aria-required'() {
      return required() ? 'true' : undefined;
    },
    get 'aria-labelledby'() {
      return ariaLabelledBy();
    },
    onFocus() {
      if (!untrack(disabled)) {
        setFocused(true);
      }
    },
    onBlur() {
      const element = inputRef.current;
      if (!element || untrack(disabled)) {
        return;
      }

      setTouched(true);
      setFocused(false);

      if (untrack(validationMode) === 'onBlur') {
        validation.commit(element.checked);
      }
    },
    onClick(event: MouseEvent) {
      if (untrack(readOnly) || untrack(disabled)) {
        return;
      }

      event.preventDefault();

      const input = inputRef.current;
      if (!input) {
        return;
      }

      dispatchClickWithModifiers(input, event);
    },
  };

  // The `value` attribute must be absent when the `value` prop is undefined so
  // the native "on" submission value applies; Solid's reactive `value` binding
  // writes the property (coercing undefined to ""), so manage the attribute
  // manually instead.
  function syncInputValueAttribute(element: HTMLInputElement | null, value: string | undefined) {
    if (!element) {
      return;
    }
    if (value === undefined) {
      element.removeAttribute('value');
    } else {
      element.setAttribute('value', value);
    }
  }

  createEffect(
    () => componentProps.value,
    (value) => {
      syncInputValueAttribute(inputRef.current, value);
    },
  );

  const inputValidationProps = createMemo(() => validation.getValidationProps(disabled()));

  const state: SwitchRootState = {
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
    get checked() {
      return checked();
    },
    get disabled() {
      return disabled();
    },
    get readOnly() {
      return readOnly();
    },
    get required() {
      return required();
    },
  };

  return (
    <SwitchRootContext value={state}>
      {useRenderElement('span', componentProps, {
        state,
        ref: [componentProps.ref, switchRef, buttonRef],
        props: [
          rootProps,
          elementProps,
          getButtonProps,
          (props: any) => validation.getValidationProps(disabled(), props),
        ],
        stateAttributesMapping,
      })}
      <Show when={!checked() && !!name() && componentProps.uncheckedValue !== undefined}>
        <input
          type="hidden"
          form={componentProps.form}
          name={name()}
          value={componentProps.uncheckedValue}
          disabled={disabled()}
        />
      </Show>
      <input
        {...inputValidationProps()}
        checked={checked()}
        disabled={disabled()}
        form={componentProps.form}
        id={hiddenInputId()}
        name={name()}
        required={required()}
        style={name() ? visuallyHiddenInput : visuallyHidden}
        tabindex={-1}
        type="checkbox"
        aria-hidden="true"
        ref={handleInputRef}
        onChange={(event: Event) => {
          const inputElement = event.currentTarget as HTMLInputElement;

          if (untrack(readOnly)) {
            event.preventDefault();
            // The input toggled natively; Solid only writes `checked` back when
            // the state changes, so revert the DOM manually. (React relies on
            // the controlled re-render instead.)
            inputElement.checked = untrack(checked);
            return;
          }

          const nextChecked = inputElement.checked;
          // React's `onChange` wraps the initiating click, so its `nativeEvent`
          // carries modifier state. The native `change` event does not, so
          // surface the click that toggled the input instead when available.
          const sourceEvent = lastInputClickEvent ?? event;
          lastInputClickEvent = null;
          const eventDetails = createChangeEventDetails(REASONS.none, sourceEvent);

          componentProps.onCheckedChange?.(nextChecked, eventDetails);

          if (eventDetails.isCanceled) {
            inputElement.checked = untrack(checked);
            return;
          }

          setCheckedState(nextChecked);

          // Reset to the committed state: if the switch is controlled and its
          // owner ignores the change, the reactive `checked` binding never
          // re-runs, so the native toggle must not stick. When the change is
          // accepted, the binding re-applies the new state on flush.
          inputElement.checked = untrack(checked);
        }}
        onClick={(event: MouseEvent) => {
          lastInputClickEvent = event;
          // The click dispatched from the root's `onClick` is an implementation detail
          // and must not reach ancestors, which already receive the original click.
          event.stopPropagation();
        }}
        onFocus={() => {
          switchRef.current?.focus();
        }}
      />
    </SwitchRootContext>
  );
}

export interface SwitchRootState extends FieldRootState {
  /**
   * Whether the switch is currently active.
   */
  checked: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user should be unable to activate or deactivate the switch.
   */
  readOnly: boolean;
  /**
   * Whether the user must activate the switch before submitting a form.
   */
  required: boolean;
}

export interface SwitchRootProps
  extends NonNativeButtonProps, Omit<BaseUIComponentProps<'span', SwitchRootState>, 'onChange'> {
  /**
   * The id of the hidden input element.
   *
   * When `nativeButton` is `true`, the id is applied to the root element.
   */
  id?: string | undefined;
  /**
   * Whether the switch is currently active.
   *
   * To render an uncontrolled switch, use the `defaultChecked` prop instead.
   */
  checked?: boolean | undefined;
  /**
   * Whether the switch is initially active.
   *
   * To render a controlled switch, use the `checked` prop instead.
   * @default false
   */
  defaultChecked?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A ref to access the hidden `<input>` element.
   */
  inputRef?: RefInput<HTMLInputElement> | undefined;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the hidden input.
   * Useful when the switch is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * Event handler called when the switch is activated or deactivated.
   */
  onCheckedChange?:
    ((checked: boolean, eventDetails: SwitchRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Whether the user should be unable to activate or deactivate the switch.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the user must activate the switch before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * The value submitted with the form when the switch is on.
   * By default, switch submits the "on" value, matching native checkbox behavior.
   */
  value?: string | undefined;
  /**
   * The value submitted with the form when the switch is off.
   * By default, unchecked switches do not submit any value, matching native checkbox behavior.
   */
  uncheckedValue?: string | undefined;
}

export type SwitchRootChangeEventReason = typeof REASONS.none;
export type SwitchRootChangeEventDetails = BaseUIChangeEventDetails<SwitchRoot.ChangeEventReason>;

export namespace SwitchRoot {
  export type State = SwitchRootState;
  export type Props = SwitchRootProps;
  export type ChangeEventReason = SwitchRootChangeEventReason;
  export type ChangeEventDetails = SwitchRootChangeEventDetails;
}
