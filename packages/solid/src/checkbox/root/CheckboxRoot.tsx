import { createEffect, createMemo, omit, onCleanup, untrack, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { EMPTY_OBJECT } from '@base-ui/utils/empty';
import { ownerWindow } from '@base-ui/utils/owner';
import { getDefaultFormSubmitter } from '@base-ui/utils/getDefaultFormSubmitter';
import { useControlled } from '../../solid-utils/useControlled';
import { applyRef, createRef, type RefInput } from '../../solid-utils/refs';
import { visuallyHidden, visuallyHiddenInput } from '../../solid-utils/visuallyHidden';
import { getCheckboxStateAttributesMapping } from '../utils/getCheckboxStateAttributesMapping';
import { dispatchClickWithModifiers } from '../../utils/dispatchClickWithModifiers';
import { useRenderElement } from '../../internals/useRenderElement';
import { useBaseUiId } from '../../internals/useBaseUiId';
import type {
  BaseUIComponentProps,
  BaseUIEvent,
  NonNativeButtonProps,
} from '../../internals/types';
import { mergeProps } from '../../merge-props';
import { useButton } from '../../internals/use-button/useButton';
import type { FieldRootState } from '../../field/root/FieldRoot';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { useRegisterFieldControl } from '../../internals/field-register-control/useRegisterFieldControl';
import { useFieldItemContext } from '../../field/item/FieldItemContext';
import { useFormContext } from '../../internals/form-context/FormContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useAriaLabelledBy } from '../../internals/labelable-provider/useAriaLabelledBy';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { useCheckboxGroupContext } from '../../checkbox-group/CheckboxGroupContext';
import { CheckboxRootContext } from './CheckboxRootContext';
import {
  type BaseUIChangeEventDetails,
  createChangeEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useValueChanged } from '../../internals/useValueChanged';

export const PARENT_CHECKBOX = 'data-parent';

/**
 * Represents the checkbox itself.
 * Renders a `<span>` element and a hidden `<input>` beside.
 *
 * Documentation: [Base UI Checkbox](https://base-ui.com/react/components/checkbox)
 */
export function CheckboxRoot(componentProps: CheckboxRoot.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'checked',
    'className',
    'class',
    'defaultChecked',
    'aria-labelledby',
    'disabled',
    'form',
    'id',
    'indeterminate',
    'inputRef',
    'name',
    'onCheckedChange',
    'parent',
    'readOnly',
    'render',
    'required',
    'uncheckedValue',
    'value',
    'nativeButton',
    'style',
    'ref',
  );

  const { clearErrors } = useFormContext();
  const {
    disabled: rootDisabled,
    name: fieldName,
    setDirty,
    setFilled,
    setFocused,
    setTouched,
    state: fieldState,
    validationMode,
    validityData,
    validation: localValidation,
  } = useFieldRootContext();
  const fieldItemContext = useFieldItemContext();
  const { labelId, registerControlId, getDescriptionProps } = useLabelableContext();

  const groupContext = useCheckboxGroupContext();

  const indeterminateProp = () => componentProps.indeterminate ?? false;
  const parentProp = () => componentProps.parent ?? false;
  const readOnly = () => componentProps.readOnly ?? false;
  const required = () => componentProps.required ?? false;
  const nativeButton = () => componentProps.nativeButton ?? false;

  const parentContext = () =>
    groupContext && groupContext.allValues() !== undefined ? groupContext.parent : undefined;
  const isGroupedWithParent = () => parentContext() !== undefined;

  const disabled = () =>
    Boolean(
      rootDisabled() ||
        fieldItemContext.disabled() ||
        groupContext?.disabled() ||
        componentProps.disabled,
    );
  const name = () => fieldName() ?? componentProps.name;
  const value = () => componentProps.value ?? name();

  const id = useBaseUiId();

  // A `CheckboxGroup` is the field's control and takes its name from `aria-labelledby`, so the
  // checkboxes sharing its labelable scope must not claim the field's control id: they would all
  // render that one id and collide. A `Field.Item` opens a scope the checkbox does own.
  const ownsControlId = groupContext?.registerControlId !== registerControlId;

  // `|| undefined` rather than `??`: an empty `id` falls back to the scope's control id.
  const controlId = useLabelableId({
    get id() {
      return (typeof componentProps.id === 'string' && componentProps.id) || undefined;
    },
    enabled: ownsControlId,
  });

  const rootId = () => (nativeButton() ? controlId() : id());

  const groupProps = (): Partial<Omit<CheckboxRoot.Props, 'className'>> => {
    const currentParentContext = parentContext();
    if (currentParentContext) {
      if (parentProp()) {
        return currentParentContext.getParentProps();
      }
      const currentValue = value();
      if (currentValue !== undefined) {
        return currentParentContext.getChildProps(currentValue);
      }
    }
    return EMPTY_OBJECT as Partial<Omit<CheckboxRoot.Props, 'className'>>;
  };

  const groupChecked = () => groupProps().checked ?? componentProps.checked;
  const groupIndeterminate = () => groupProps().indeterminate ?? indeterminateProp();
  const groupOnChange = (
    nextChecked: boolean,
    eventDetails: CheckboxRoot.ChangeEventDetails,
  ) => {
    untrack(groupProps).onCheckedChange?.(nextChecked, eventDetails);
  };

  const controlRef = createRef<HTMLElement>();

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return disabled();
    },
    get native() {
      return nativeButton();
    },
  });

  const validation = groupContext?.validation ?? localValidation;

  const [checked, setCheckedState] = useControlled({
    controlled: () => {
      const currentValue = value();
      const currentGroupValue = groupContext?.value();
      return currentValue !== undefined && currentGroupValue !== undefined && !parentProp()
        ? currentGroupValue.includes(currentValue)
        : groupChecked();
    },
    default: untrack(() => componentProps.defaultChecked ?? false),
    name: 'Checkbox',
    state: 'checked',
  });

  const computedChecked = () => (isGroupedWithParent() ? Boolean(groupChecked()) : checked());
  const computedIndeterminate = () =>
    isGroupedWithParent() ? groupIndeterminate() || indeterminateProp() : indeterminateProp();

  useRegisterFieldControl(
    controlRef,
    id,
    checked,
    undefined,
    () => !groupContext && !disabled(),
    () => componentProps.name,
  );

  const inputRef = createRef<HTMLInputElement>();
  // The click that toggles the hidden input; its `change` handler reports this
  // event (with modifier state) to match React's `onChange` nativeEvent.
  let lastInputClickEvent: MouseEvent | null = null;
  // The registration object stays live through its `value` getter, so the shared
  // registry always reflects the current value without re-registering.
  const inputRegistration = {
    controlRef,
    get value() {
      return groupContext ? untrack(value) : undefined;
    },
  };

  const handleInputRef = (element: HTMLInputElement | null) => {
    inputRef.current = element;
    applyRef(
      untrack(() => componentProps.inputRef),
      element,
    );
    syncInputValueAttribute(element, untrack(hiddenInputValue));
  };
  onCleanup(() => {
    handleInputRef(null);
  });

  // A post-render effect so the input element exists when registration runs,
  // matching the React callback-ref timing.
  createEffect(
    () => parentProp(),
    (isParent) => {
      const element = inputRef.current;
      if (isParent || !element) {
        return undefined;
      }
      const unregister = validation.registerInput(element, inputRegistration);
      return () => {
        unregister?.();
      };
    },
  );

  const ariaLabelledBy = useAriaLabelledBy(
    () => {
      const ariaLabelledByProp = componentProps['aria-labelledby'];
      return typeof ariaLabelledByProp === 'string' ? ariaLabelledByProp : undefined;
    },
    labelId,
    inputRef,
    () => !nativeButton(),
    controlId,
  );

  createEffect(
    () => ({ checked: checked(), indeterminate: computedIndeterminate() }),
    (current) => {
      if (inputRef.current) {
        // Re-assert on `checked` changes too: clicking the input natively resets `indeterminate`.
        inputRef.current.indeterminate = current.indeterminate;
      }
      // Inside a group, the group derives the filled state from its value.
      if (!groupContext) {
        setFilled(current.checked);
      }
    },
  );

  useValueChanged(checked, () => {
    if (groupContext) {
      return;
    }

    clearErrors(untrack(name));
    setDirty(untrack(checked) !== untrack(validityData).initialValue);

    validation.change(untrack(checked));
  });

  // The `value` attribute must be absent when the `value` prop is undefined so
  // the native "on" submission value applies; Solid's reactive `value` binding
  // writes the property (coercing undefined to ""), so manage the attribute
  // manually instead.
  const hiddenInputValue = () => {
    const valueProp = componentProps.value;
    if (valueProp === undefined) {
      return undefined;
    }
    return (groupContext ? checked() && valueProp : valueProp) || '';
  };

  function syncInputValueAttribute(
    element: HTMLInputElement | null,
    inputValue: string | undefined,
  ) {
    if (!element) {
      return;
    }
    if (inputValue === undefined) {
      element.removeAttribute('value');
    } else {
      element.setAttribute('value', inputValue);
    }
  }

  createEffect(
    () => hiddenInputValue(),
    (inputValue) => {
      syncInputValueAttribute(inputRef.current, inputValue);
    },
  );

  const inputExtraProps = createMemo(() =>
    mergeProps(getDescriptionProps, (props: any) => validation.getValidationProps(disabled(), props)),
  );

  createEffect(
    () => ({ parentContext: parentContext(), disabled: disabled(), value: value() }),
    (current) => {
      if (!current.parentContext || current.value === undefined) {
        return undefined;
      }

      const currentValue = current.value;
      const disabledStates = current.parentContext.disabledStatesRef.current!;
      disabledStates.set(currentValue, current.disabled);

      return () => {
        disabledStates.delete(currentValue);
      };
    },
  );

  const state: CheckboxRootState = {
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
      return computedChecked();
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
    get indeterminate() {
      return computedIndeterminate();
    },
  };

  const stateAttributesMapping = getCheckboxStateAttributesMapping(state);

  const rootProps = {
    get id() {
      return rootId();
    },
    role: 'checkbox',
    get 'aria-checked'() {
      // Solid renders boolean attribute values as presence/absence; aria
      // attributes need explicit strings.
      if (computedIndeterminate()) {
        return 'mixed';
      }
      return computedChecked() ? 'true' : 'false';
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
    get [PARENT_CHECKBOX]() {
      return parentProp() ? '' : undefined;
    },
    onFocus() {
      if (!untrack(disabled)) {
        setFocused(true);
      }
    },
    onBlur() {
      const inputEl = inputRef.current;
      if (!inputEl) {
        return;
      }

      setTouched(true);
      setFocused(false);

      if (untrack(validationMode) === 'onBlur') {
        validation.commit(groupContext ? untrack(() => groupContext.value()) : inputEl.checked);
      }
    },
    onKeyDown(event: BaseUIEvent<KeyboardEvent>) {
      if (event.key !== 'Enter') {
        return;
      }

      // Let consumer `preventDefault()` handlers opt out while defensively stopping
      // any remaining Base UI Enter handling from treating the checkbox as a button.
      event.preventBaseUIHandler();

      if (event.defaultPrevented) {
        return;
      }

      const formToSubmit = inputRef.current?.form ?? null;
      const currentTarget = event.currentTarget as Element;
      const originalPreventDefault = event.preventDefault;
      let preventDefaultCalledAfterPropagation = false;

      event.preventDefault = () => {
        preventDefaultCalledAfterPropagation = true;
        originalPreventDefault.call(event);
      };

      // Enter should not activate/toggle the checkbox. Cancel the native button behavior
      // right away; ancestor handlers can still opt out of the form submission by calling
      // `preventDefault()` during propagation, which is observed through the patched method.
      originalPreventDefault.call(event);

      ownerWindow(currentTarget).queueMicrotask(() => {
        event.preventDefault = originalPreventDefault;

        if (!preventDefaultCalledAfterPropagation) {
          getDefaultFormSubmitter(formToSubmit)?.click();
        }
      });
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

  const otherGroupProps = {
    get 'aria-controls'() {
      return (groupProps() as Record<string, any>)['aria-controls'];
    },
  };

  // React reads the id off the produced element, so a `render` callback that
  // writes its own `id` after spreading the props wins. Track the merged root
  // id for reactivity, but report the id actually present on the DOM element.
  createEffect(
    () => ({
      registerChildId: parentContext()?.registerChildId,
      parent: parentProp(),
      value: value(),
      renderedId: rootId(),
    }),
    (current) => {
      const renderedId = controlRef.current?.id || current.renderedId;
      if (
        !current.registerChildId ||
        current.parent ||
        current.value === undefined ||
        renderedId === undefined
      ) {
        return undefined;
      }

      return current.registerChildId(current.value, renderedId);
    },
  );

  return (
    <CheckboxRootContext value={state}>
      {useRenderElement('span', componentProps, {
        state,
        ref: [buttonRef, controlRef, componentProps.ref],
        props: [
          rootProps,
          elementProps,
          otherGroupProps,
          getButtonProps,
          getDescriptionProps,
          (props: any) => validation.getValidationProps(disabled(), props),
        ],
        stateAttributesMapping,
      })}
      <Show
        when={
          !checked() &&
          !groupContext &&
          !!name() &&
          !parentProp() &&
          componentProps.uncheckedValue !== undefined
        }
      >
        <input
          type="hidden"
          form={componentProps.form}
          name={name()}
          value={componentProps.uncheckedValue}
          disabled={disabled()}
        />
      </Show>
      <input
        {...inputExtraProps()}
        checked={checked()}
        disabled={disabled()}
        form={componentProps.form}
        name={parentProp() ? undefined : name()}
        id={nativeButton() ? undefined : controlId()}
        required={required()}
        ref={handleInputRef}
        style={name() ? visuallyHiddenInput : visuallyHidden}
        tabindex={-1}
        type="checkbox"
        aria-hidden="true"
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
          const details = createChangeEventDetails(REASONS.none, sourceEvent);

          componentProps.onCheckedChange?.(nextChecked, details);

          if (details.isCanceled) {
            inputElement.checked = untrack(checked);
            return;
          }

          groupOnChange(nextChecked, details);

          if (details.isCanceled) {
            inputElement.checked = untrack(checked);
            return;
          }

          setCheckedState(nextChecked);

          const currentValue = untrack(value);
          if (
            currentValue !== undefined &&
            groupContext !== undefined &&
            !untrack(parentProp) &&
            !untrack(isGroupedWithParent)
          ) {
            const currentGroupValue = untrack(() => groupContext.value());
            const nextGroupValue = nextChecked
              ? [...currentGroupValue, currentValue]
              : currentGroupValue.filter((item) => item !== currentValue);

            groupContext.setValue(nextGroupValue, details);
          }

          // Reset to the committed state: if the checkbox is controlled and its
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
          controlRef.current?.focus();
        }}
      />
    </CheckboxRootContext>
  );
}

export interface CheckboxRootState extends FieldRootState {
  /**
   * Whether the checkbox is currently ticked.
   */
  checked: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user should be unable to tick or untick the checkbox.
   */
  readOnly: boolean;
  /**
   * Whether the user must tick the checkbox before submitting a form.
   */
  required: boolean;
  /**
   * Whether the checkbox is in a mixed state: neither ticked, nor unticked.
   */
  indeterminate: boolean;
}

export interface CheckboxRootProps
  extends
    NonNativeButtonProps,
    Omit<BaseUIComponentProps<'span', CheckboxRootState>, 'onChange' | 'value'> {
  /**
   * The id of the input element.
   */
  id?: string | undefined;
  /**
   * Identifies the field when a form is submitted.
   * @default undefined
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the hidden input.
   * Useful when the checkbox is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * Whether the checkbox is currently ticked.
   *
   * To render an uncontrolled checkbox, use the `defaultChecked` prop instead.
   * @default undefined
   */
  checked?: boolean | undefined;
  /**
   * Whether the checkbox is initially ticked.
   *
   * To render a controlled checkbox, use the `checked` prop instead.
   * @default false
   */
  defaultChecked?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Event handler called when the checkbox is ticked or unticked.
   */
  onCheckedChange?:
    ((checked: boolean, eventDetails: CheckboxRootChangeEventDetails) => void) | undefined;
  /**
   * Whether the user should be unable to tick or untick the checkbox.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the user must tick the checkbox before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Whether the checkbox is in a mixed state: neither ticked, nor unticked.
   * @default false
   */
  indeterminate?: boolean | undefined;
  /**
   * A ref to access the hidden `<input>` element.
   */
  inputRef?: RefInput<HTMLInputElement> | undefined;
  /**
   * Whether the checkbox controls a group of child checkboxes.
   *
   * Must be used in a [Checkbox Group](https://base-ui.com/react/components/checkbox-group).
   * @default false
   */
  parent?: boolean | undefined;
  /**
   * The value submitted with the form when the checkbox is unchecked.
   * By default, unchecked checkboxes do not submit any value, matching native checkbox behavior.
   */
  uncheckedValue?: string | undefined;
  /**
   * The checkbox's value. Identifies it within a [Checkbox Group](https://base-ui.com/react/components/checkbox-group), falling back to `name` when omitted.
   * When submitting a form, a checked box submits `value`; with no `value`, it submits the native "on".
   */
  value?: string | undefined;
}

export type CheckboxRootChangeEventReason = typeof REASONS.none;
export type CheckboxRootChangeEventDetails =
  BaseUIChangeEventDetails<CheckboxRoot.ChangeEventReason>;

export namespace CheckboxRoot {
  export type State = CheckboxRootState;
  export type Props = CheckboxRootProps;
  export type ChangeEventReason = CheckboxRootChangeEventReason;
  export type ChangeEventDetails = CheckboxRootChangeEventDetails;
}
