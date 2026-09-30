import { createEffect, omit, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { EMPTY_OBJECT } from '@base-ui/utils/empty';
import type { BaseUIComponentProps, HTMLProps, NonNativeButtonProps } from '../../internals/types';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { NOOP } from '../../internals/noop';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';
import { dispatchClickWithModifiers } from '../../utils/dispatchClickWithModifiers';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { useButton } from '../../internals/use-button';
import { ACTIVE_COMPOSITE_ITEM } from '../../internals/composite/constants';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';
import type { FieldRootState } from '../../field/root/FieldRoot';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { useFieldItemContext } from '../../field/item/FieldItemContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useAriaLabelledBy } from '../../internals/labelable-provider/useAriaLabelledBy';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { useRadioGroupContext } from '../../radio-group/RadioGroupContext';
import { serializeValue } from '../../internals/serializeValue';
import { applyRef, createRef, type Ref } from '../../solid-utils/refs';
import { visuallyHidden, visuallyHiddenInput } from '../../solid-utils/visuallyHidden';
import { RadioRootContext } from './RadioRootContext';

/**
 * Represents the radio button itself.
 * Renders a `<span>` element and a hidden `<input>` beside.
 *
 * Documentation: [Base UI Radio](https://base-ui.com/react/components/radio)
 */
export function RadioRoot<Value>(componentProps: RadioRoot.Props<Value>): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'className',
    'class',
    'disabled',
    'readOnly',
    'required',
    'aria-labelledby',
    'value',
    'inputRef',
    'nativeButton',
    'id',
    'style',
    'ref',
  );

  const groupContext = useRadioGroupContext();

  const setCheckedValue = groupContext?.setCheckedValue ?? NOOP;
  const setGroupTouched = groupContext?.setTouched ?? NOOP;
  const registerInputRef = groupContext?.registerInputRef ?? NOOP;
  const validation = groupContext?.validation;

  const {
    setTouched: setFieldTouched,
    setFilled,
    state: fieldState,
    disabled: fieldDisabled,
  } = useFieldRootContext();
  const fieldItemContext = useFieldItemContext();
  const { labelId, getDescriptionProps } = useLabelableContext();

  const disabled = () =>
    Boolean(
      fieldDisabled() ||
        fieldItemContext.disabled() ||
        groupContext?.disabled() ||
        componentProps.disabled,
    );
  const readOnly = () => Boolean(groupContext?.readOnly() || componentProps.readOnly);
  const required = () => Boolean(groupContext?.required() || componentProps.required);
  const form = () => groupContext?.form();
  const name = () => groupContext?.name();
  const touched = () => groupContext?.touched() ?? false;
  const nativeButton = () => componentProps.nativeButton ?? false;

  const checked = () =>
    groupContext
      ? groupContext.checkedValue() === componentProps.value
      : (componentProps.value as unknown) === '';

  const radioRef = createRef<HTMLElement>();
  const inputRef = createRef<HTMLInputElement>();

  const registerInput = (element: HTMLInputElement) =>
    validation?.registerInput(element, { controlRef: radioRef, value: undefined });

  // Mirrors the React mount layout effect. A post-render effect so the input
  // ref is already populated when the initial checked state is inspected.
  createEffect(
    () => undefined,
    () => {
      if (inputRef.current?.checked) {
        setFilled(true);
      }
    },
  );

  createEffect(
    () => ({ checked: checked(), disabled: disabled() }),
    (current) => {
      if (!inputRef.current) {
        return;
      }

      if (current.disabled && current.checked) {
        // Re-pointing only; the mount-time registration owns the cleanup.
        void registerInputRef(null);
        return;
      }

      void registerInputRef(inputRef.current);
    },
  );

  const id = useBaseUiId();
  const inputId = useLabelableId({
    get id() {
      return typeof componentProps.id === 'string' ? componentProps.id : undefined;
    },
  });
  const hiddenInputId = () => (nativeButton() ? undefined : inputId());
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

  const rootProps: HTMLProps = {
    role: 'radio',
    // Solid renders boolean attribute values as presence/absence; aria
    // attributes need explicit strings.
    get 'aria-checked'() {
      return checked() ? 'true' : 'false';
    },
    get 'aria-labelledby'() {
      return ariaLabelledBy();
    },
    get [ACTIVE_COMPOSITE_ITEM as string]() {
      return checked() ? '' : undefined;
    },
    get id() {
      return nativeButton() ? inputId() : id();
    },
    onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Enter') {
        // Radio only activates with Space. Preventing the keydown's default
        // stops useButton from turning Enter into a click.
        event.preventDefault();
      }
    },
    onClick(event: MouseEvent) {
      if (event.defaultPrevented || disabled() || readOnly()) {
        return;
      }

      event.preventDefault();

      const input = inputRef.current;
      if (!input) {
        return;
      }

      dispatchClickWithModifiers(input, event);
    },
    onFocus(event: FocusEvent) {
      if (event.defaultPrevented || disabled() || readOnly() || !touched()) {
        return;
      }

      inputRef.current?.click();

      setGroupTouched(false);
    },
  };

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return disabled();
    },
    get native() {
      return nativeButton();
    },
    composite: false,
  });

  // The hidden input's ref runs before dynamic bindings may have applied, so
  // sync the properties the registration logic reads. Refs apply in an
  // unowned phase, so the cleanups are captured and released from a
  // component-body `onCleanup` instead of one registered inside the ref.
  let groupRegistrationCleanup: void | (() => void);
  let fieldRegistrationCleanup: void | (() => void);

  const hiddenInputRef = (element: HTMLInputElement) => {
    element.checked = untrack(checked);
    element.disabled = untrack(disabled);

    applyRef(untrack(() => componentProps.inputRef), element);
    inputRef.current = element;

    groupRegistrationCleanup = registerInputRef(element);
    fieldRegistrationCleanup = registerInput(element);
  };

  onCleanup(() => {
    if (typeof fieldRegistrationCleanup === 'function') {
      fieldRegistrationCleanup();
    }
    if (typeof groupRegistrationCleanup === 'function') {
      groupRegistrationCleanup();
    }
    inputRef.current = null;
    applyRef(untrack(() => componentProps.inputRef), null);
  });

  // React's `onChange` for radio inputs is driven by the click event
  // (`event.nativeEvent` is the click), so the change logic lives in the
  // input's click handler: a native `change` event carries no modifier state.
  // The click listener runs after the pre-click activation set `checked`, and
  // `preventDefault()` makes the canceled activation restore the old state.
  const handleInputClick = (event: MouseEvent) => {
    // Clicks dispatched on the input from the root's `onClick` and `onFocus` are an
    // implementation detail and must not reach ancestors.
    event.stopPropagation();

    if (event.defaultPrevented) {
      return;
    }

    if (disabled() || readOnly() || componentProps.value === undefined) {
      event.preventDefault();
      return;
    }

    if (untrack(checked)) {
      // Clicking an already-selected radio produces no change event.
      return;
    }

    const details = createChangeEventDetails(REASONS.none, event);

    setCheckedValue(componentProps.value, details);

    if (details.isCanceled) {
      event.preventDefault();
      return;
    }

    setFieldTouched(true);
  };

  const state: RadioRootState = {
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
      return required();
    },
    get disabled() {
      return disabled();
    },
    get readOnly() {
      return readOnly();
    },
    get checked() {
      return checked();
    },
  };

  const contextValue: RadioRootContext = state;

  const refs: Ref<HTMLElement>[] = [
    radioRef,
    buttonRef,
    (el: HTMLElement | null) => applyRef(componentProps.ref, el),
  ];
  const props = [
    rootProps,
    elementProps,
    getButtonProps,
    getDescriptionProps,
    validation
      ? (validationProps: HTMLProps) => validation.getValidationProps(disabled(), validationProps)
      : (EMPTY_OBJECT as HTMLProps),
  ];

  // Context presence is fixed for the lifetime of the component, so this is a
  // static branch (not a reactive condition).
  return (
    <RadioRootContext value={contextValue}>
      {groupContext ? (
        <CompositeItem
          tag="span"
          render={componentProps.render}
          className={componentProps.className}
          class={componentProps.class}
          style={componentProps.style}
          state={state}
          refs={refs}
          props={props}
          stateAttributesMapping={stateAttributesMapping}
        />
      ) : (
        useRenderElement('span', componentProps, {
          state,
          ref: refs,
          props,
          stateAttributesMapping,
        })
      )}
      <input
        type="radio"
        ref={hiddenInputRef}
        form={form()}
        id={hiddenInputId()}
        name={name()}
        tabindex={-1}
        style={name() ? visuallyHiddenInput : visuallyHidden}
        aria-hidden="true"
        value={componentProps.value === undefined ? '' : serializeValue(componentProps.value)}
        disabled={disabled()}
        checked={checked()}
        required={required()}
        readonly={readOnly()}
        onClick={handleInputClick}
        onFocus={() => {
          radioRef.current?.focus();
        }}
      />
    </RadioRootContext>
  );
}

export interface RadioRootState extends FieldRootState {
  /**
   * Whether the radio button is currently selected.
   */
  checked: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user should be unable to select the radio button.
   */
  readOnly: boolean;
  /**
   * Whether the user must choose a value before submitting a form.
   */
  required: boolean;
  /**
   * Whether the radio button has been touched (when wrapped in Field.Root).
   */
  touched: boolean;
  /**
   * Whether the radio button's value has changed from its initial value (when wrapped in Field.Root).
   */
  dirty: boolean;
  /**
   * Whether the radio button is in a valid state (when wrapped in Field.Root).
   */
  valid: boolean | null;
  /**
   * Whether the radio button has a value (when wrapped in Field.Root).
   */
  filled: boolean;
  /**
   * Whether the radio button is focused (when wrapped in Field.Root).
   */
  focused: boolean;
}

export interface RadioRootProps<Value = any>
  extends NonNativeButtonProps, Omit<BaseUIComponentProps<'span', RadioRootState>, 'value'> {
  /**
   * The unique identifying value of the radio in a group.
   */
  value: Value;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled?: boolean | undefined;
  /**
   * Whether the user must choose a value before submitting a form.
   */
  required?: boolean | undefined;
  /**
   * Whether the user should be unable to select the radio button.
   */
  readOnly?: boolean | undefined;
  /**
   * A ref to access the hidden input element.
   */
  inputRef?:
    | ((element: HTMLInputElement | null) => void)
    | { current: HTMLInputElement | null }
    | undefined;
}

export namespace RadioRoot {
  export type State = RadioRootState;
  export type Props<TValue = any> = RadioRootProps<TValue>;
}
