import {
  createMemo,
  createRenderEffect,
  onCleanup,
  untrack,
  Show,
  For,
} from 'solid-js';
import type { JSX } from '@solidjs/web';
import { isElementDisabled } from '@base-ui/utils/isElementDisabled';
import { EMPTY_ARRAY, EMPTY_OBJECT } from '@base-ui/utils/empty';
import { type InteractionType } from '@base-ui/utils/useEnhancedClickHandler';
import {
  useClick,
  useDismiss,
  useFloatingRootContext,
  useListNavigation,
  useTypeahead,
} from '../../floating-ui-react';
import {
  SelectFloatingContext,
  SelectRootContext,
  SelectRootPropsContext,
  type SelectRootPropsContextValue,
} from './SelectRootContext';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { useRegisterFieldControl } from '../../internals/field-register-control/useRegisterFieldControl';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { useTransitionStatus } from '../../internals/useTransitionStatus';
import { selectors, type SelectStoreContext, type State as StoreState } from '../store';
import {
  type BaseUIChangeEventDetails,
  createChangeEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useFormContext } from '../../internals/form-context/FormContext';
import { type Group, stringifyAsLabel, stringifyAsValue } from '../../internals/resolveValueLabel';
import {
  defaultItemEquality,
  findItemIndex,
  isSelectedValueDirty,
} from '../../internals/itemEquality';
import { useValueChanged } from '../../internals/useValueChanged';
import { useOpenInteractionType } from '../../utils/useOpenInteractionType';
import { getMaxScrollOffset, normalizeScrollOffset } from '../../utils/scrollEdges';
import { FOCUSABLE_POPUP_PROPS } from '../../utils/popups';
import { mergeProps } from '../../merge-props';
import { NOOP } from '../../internals/noop';
import { Store } from '../../solid-utils/store';
import { useControlled } from '../../solid-utils/useControlled';
import { applyRef, createRef, type RefInput, type RefObject } from '../../solid-utils/refs';
import { visuallyHidden, visuallyHiddenInput } from '../../solid-utils/visuallyHidden';
import { IsolateChildren } from '../../solid-utils/isolateChildren';
import type { HTMLProps } from '../../internals/types';

/**
 * Groups all parts of the select.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectRoot<Value, Multiple extends boolean | undefined = false>(
  props: SelectRoot.Props<Value, Multiple>,
): JSX.Element {
  const multiple = () => (props.multiple ?? false) as boolean;
  const readOnly = () => props.readOnly ?? false;
  const required = () => props.required ?? false;
  const modal = () => props.modal ?? true;
  const highlightItemOnHover = () => props.highlightItemOnHover ?? true;
  const isItemEqualToValue = () => props.isItemEqualToValue ?? defaultItemEquality;

  const { clearErrors } = useFormContext();
  const fieldContext = useFieldRootContext();
  const {
    setDirty,
    setTouched,
    setFocused,
    validityData,
    setFilled,
    name: fieldName,
    disabled: fieldDisabled,
    validation,
    validationMode,
  } = fieldContext;

  const generatedId = useLabelableId({
    get id() {
      return props.id;
    },
  });

  const disabled = () => (fieldDisabled() ?? false) || (props.disabled ?? false);
  const name = () => fieldName() ?? props.name;

  const [value, setValueUnwrapped] = useControlled<any>({
    controlled: () => props.value,
    default: untrack(() =>
      multiple() ? ((props.defaultValue ?? null) ?? EMPTY_ARRAY) : (props.defaultValue ?? null),
    ),
    name: 'Select',
    state: 'value',
  });

  const [open, setOpenUnwrapped] = useControlled<boolean>({
    controlled: () => props.open,
    default: untrack(() => props.defaultOpen ?? false),
    name: 'Select',
    state: 'open',
  });

  const listRef = { current: [] as Array<HTMLElement | null> };
  const labelsRef = { current: [] as Array<string | null> };
  const popupRef = createRef<HTMLDivElement>();
  const scrollHandlerRef = createRef<(el: HTMLDivElement) => void>();
  const scrollArrowsMountedCountRef = { current: 0 };
  const valueRef = createRef<HTMLSpanElement>();
  const valuesRef = { current: [] as Array<any> };
  const typingRef = { current: false };
  const firstItemTextRef = createRef<HTMLElement>();
  const selectedItemTextRef = createRef<HTMLElement>();
  const selectionRef = {
    current: {
      allowSelectedMouseUp: false,
      allowUnselectedMouseUp: false,
      dragY: 0,
    },
  };
  const alignItemWithTriggerActiveRef = { current: false };
  const initialValueRef = { current: untrack(value) };

  const { mounted, setMounted, transitionStatus } = useTransitionStatus(() => open());
  const { openMethod, triggerProps: interactionTypeProps } = useOpenInteractionType(() => open());

  const store = untrack(
    () =>
      new Store<StoreState, SelectStoreContext, typeof selectors>(
        {
          id: generatedId(),
          labelId: undefined,
          modal: modal(),
          multiple: multiple(),
          itemToStringLabel: props.itemToStringLabel,
          itemToStringValue: props.itemToStringValue,
          isItemEqualToValue: isItemEqualToValue(),
          value: value(),
          open: open(),
          mounted: mounted(),
          transitionStatus: transitionStatus(),
          items: props.items,
          forceMount: false,
          openMethod: null,
          activeIndex: null,
          selectedIndex: null,
          popupProps: EMPTY_OBJECT,
          triggerProps: EMPTY_OBJECT,
          triggerElement: null,
          positionerElement: null,
          listElement: null,
          popupSide: null,
          scrollUpArrowVisible: false,
          scrollDownArrowVisible: false,
          hasScrollArrows: false,
        },
        {
          setValue: NOOP,
          setOpen: NOOP,
          handleScrollArrowVisibility: NOOP,
          onOpenChangeComplete: NOOP,
          listRef,
          popupRef,
          scrollHandlerRef,
          scrollArrowsMountedCountRef,
          valueRef,
          valuesRef,
          labelsRef,
          typingRef,
          selectionRef,
          firstItemTextRef,
          selectedItemTextRef,
          alignItemWithTriggerActiveRef,
          initialValueRef,
        },
        selectors,
      ),
  );

  const activeIndex = store.useState('activeIndex');
  const selectedIndex = store.useState('selectedIndex');
  const triggerElement = store.useState('triggerElement');
  const positionerElement = store.useState('positionerElement');

  // Mirrors the React `usePreviousValue(openMethod)` pairing: keep the last non-null
  // interaction type while the popup is transitioning out, and drop it on unmount.
  const renderedOpenMethod = createMemo<InteractionType | null>((prev) => {
    const method = openMethod();
    if (method !== null) {
      return method;
    }
    return mounted() ? (prev ?? null) : null;
  });

  const serializedValue = createMemo(() => {
    // In multiple mode the shared input is nameless; per-value entries are submitted via
    // `hiddenInputs`. Its value is therefore irrelevant, and passing the whole array to
    // `stringifyAsValue` would invoke a user `itemToStringValue` with an array it doesn't expect.
    if (multiple()) {
      return '';
    }
    return stringifyAsValue(value(), props.itemToStringValue);
  });

  const fieldStringValue = createMemo(() => {
    const currentValue = value();
    if (multiple() && Array.isArray(currentValue)) {
      return currentValue.map((current) => stringifyAsValue(current, props.itemToStringValue));
    }
    return stringifyAsValue(currentValue, props.itemToStringValue);
  });

  const controlRef: RefObject<HTMLElement> = {
    get current() {
      return triggerElement();
    },
    set current(_value) {
      // The trigger element is store-managed; ref writes are ignored.
    },
  };
  const getStringifiedValueForForm = () => untrack(fieldStringValue);

  useRegisterFieldControl(
    controlRef,
    generatedId,
    value,
    getStringifiedValueForForm,
    () => !disabled(),
    () => props.name,
  );

  // Mirror the `hasSelectedValue` store selector so the Field's filled state agrees with the
  // trigger/value placeholder semantics (a value serializing to `''` counts as empty).
  const hasSelectedValue = createMemo(() =>
    multiple()
      ? Array.isArray(value()) && value().length > 0
      : value() != null && serializedValue() !== '',
  );

  createRenderEffect(hasSelectedValue, (filled) => {
    setFilled(filled);
  });

  createRenderEffect(
    () => ({
      multiple: multiple(),
      open: open(),
      value: value(),
      isItemEqualToValue: isItemEqualToValue(),
    }),
    function syncSelectedIndex(current) {
      let target: unknown = current.value;
      let empty = false;

      if (current.multiple) {
        const currentValue = Array.isArray(current.value) ? current.value : [];
        empty = currentValue.length === 0;
        target = currentValue[currentValue.length - 1];
      }

      const index = empty
        ? -1
        : findItemIndex(valuesRef.current, target as Value, current.isItemEqualToValue);
      const nextIndex = index === -1 ? null : index;

      if (nextIndex === null) {
        selectedItemTextRef.current = null;
      }

      if (current.open) {
        return;
      }

      store.set('selectedIndex', nextIndex);
    },
  );

  useValueChanged(value, () => {
    clearErrors(untrack(name));
    setDirty(
      isSelectedValueDirty(
        untrack(value),
        untrack(validityData).initialValue,
        untrack(isItemEqualToValue),
      ),
    );

    validation.change(untrack(value));
  });

  const setOpen = (nextOpen: boolean, eventDetails: SelectRoot.ChangeEventDetails) => {
    props.onOpenChange?.(nextOpen, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setOpenUnwrapped(nextOpen);

    if (
      !nextOpen &&
      (eventDetails.reason === REASONS.focusOut || eventDetails.reason === REASONS.outsidePress)
    ) {
      setTouched(true);
      setFocused(false);

      if (untrack(validationMode) === 'onBlur') {
        validation.commit(untrack(value));
      }
    }
  };

  const handleUnmount = () => {
    setMounted(false);
    store.update({
      activeIndex: null,
      openMethod: null,
      scrollUpArrowVisible: false,
      scrollDownArrowVisible: false,
    });
    props.onOpenChangeComplete?.(false);
  };

  useOpenChangeComplete({
    get enabled() {
      return !props.actionsRef;
    },
    get open() {
      return open();
    },
    ref: popupRef,
    onComplete() {
      if (!untrack(open)) {
        handleUnmount();
      }
    },
  });

  const actions: SelectRoot.Actions = { unmount: handleUnmount };

  createRenderEffect(
    () => props.actionsRef,
    (actionsRef) => {
      if (actionsRef) {
        applyRef(actionsRef, actions);
        return () => applyRef(actionsRef, null);
      }
      return undefined;
    },
  );
  void onCleanup(() => {
    const actionsRef = untrack(() => props.actionsRef);
    if (actionsRef && actionsRef.current === actions) {
      applyRef(actionsRef, null);
    }
  });

  const setValue = (nextValue: any, eventDetails: SelectRoot.ChangeEventDetails) => {
    props.onValueChange?.(nextValue, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setValueUnwrapped(() => nextValue);
  };

  const handleScrollArrowVisibility = (scroller: HTMLElement) => {
    const maxScrollTop = getMaxScrollOffset(scroller.scrollHeight, scroller.clientHeight);
    const scrollTop = normalizeScrollOffset(scroller.scrollTop, maxScrollTop);
    const shouldShowUp = scrollTop > 0;
    const shouldShowDown = scrollTop < maxScrollTop;

    store.set('scrollUpArrowVisible', shouldShowUp);
    store.set('scrollDownArrowVisible', shouldShowDown);
  };

  const floatingContext = useFloatingRootContext({
    get open() {
      return open();
    },
    onOpenChange: setOpen,
    elements: {
      get reference() {
        return triggerElement();
      },
      get floating() {
        return positionerElement();
      },
    },
  });

  // `readOnly` locks the value, not the interaction: the popup can be opened and browsed so the
  // user can see the available options and which one is selected. Committing a value is blocked
  // separately in `SelectItem` and in the hidden input's autofill handler.
  const click = useClick(floatingContext, {
    get enabled() {
      return !disabled();
    },
    event: 'mousedown',
  });

  const dismiss = useDismiss(floatingContext);

  const listNavigation = useListNavigation(floatingContext, {
    get enabled() {
      return !disabled();
    },
    listRef,
    get activeIndex() {
      return activeIndex();
    },
    get selectedIndex() {
      return selectedIndex();
    },
    disabledIndices: EMPTY_ARRAY as ReadonlyArray<number>,
    onNavigate(nextActiveIndex) {
      // Retain the highlight while transitioning out.
      if (nextActiveIndex === null && !untrack(open)) {
        return;
      }

      store.set('activeIndex', nextActiveIndex);
    },
    get focusItemOnHover() {
      return highlightItemOnHover();
    },
  });

  const typeahead = useTypeahead(floatingContext, {
    // Typeahead on an open popup only moves the highlight, so it remains available while
    // `readOnly`. The closed-trigger variant commits a value instead, so it doesn't.
    get enabled() {
      return !disabled() && (open() || (!readOnly() && !multiple()));
    },
    listRef: labelsRef,
    get activeIndex() {
      return activeIndex();
    },
    get selectedIndex() {
      return selectedIndex();
    },
    // Skip disabled items while matching so typeahead advances to the next selectable item
    // (a click can never select a disabled item and native `<select>` skips them too). Resolve
    // the disabled state from the element via the attribute-only `isElementDisabled` so the
    // hidden, force-mounted items used for closed-trigger typeahead aren't dropped by the
    // `elementsRef`/visibility filter that `disabledIndices` deliberately sidesteps.
    disabledIndices: (index: number) => isElementDisabled(listRef.current[index]),
    onMatch(index) {
      if (untrack(open)) {
        store.set('activeIndex', index);
      } else {
        setValue(valuesRef.current[index], createChangeEventDetails(REASONS.none));
      }
    },
    onTyping(typing) {
      typingRef.current = typing;
    },
  });

  // `Select.Trigger` applies the id itself from the store, so it's deliberately not merged here.
  const mergedTriggerProps = createMemo(() =>
    mergeProps(
      typeahead.reference,
      listNavigation.reference,
      dismiss.reference,
      click.reference,
      interactionTypeProps,
    ),
  );

  const popupProps = createMemo(() =>
    mergeProps(FOCUSABLE_POPUP_PROPS, typeahead.floating, listNavigation.floating, dismiss.floating),
  );

  const itemProps = createMemo(() => (listNavigation.item as HTMLProps | undefined) ?? EMPTY_OBJECT);

  store.useContextCallback('setValue', () => setValue);
  store.useContextCallback('setOpen', () => setOpen);
  store.useContextCallback('handleScrollArrowVisibility', () => handleScrollArrowVisibility);
  store.useContextCallback('onOpenChangeComplete', () => props.onOpenChangeComplete);

  // The prop bags must be in the store before the parts render. `useSyncedValues` writes in a
  // render effect, after all descendants have rendered.
  untrack(() => {
    store.update({
      popupProps: popupProps(),
      triggerProps: mergedTriggerProps(),
    });
  });

  store.useSyncedValues({
    get id() {
      return generatedId();
    },
    get modal() {
      return modal();
    },
    get multiple() {
      return multiple();
    },
    get value() {
      return value();
    },
    get open() {
      return open();
    },
    get mounted() {
      return mounted();
    },
    get transitionStatus() {
      return transitionStatus();
    },
    get popupProps() {
      return popupProps();
    },
    get triggerProps() {
      return mergedTriggerProps();
    },
    get items() {
      return props.items;
    },
    get itemToStringLabel() {
      return props.itemToStringLabel;
    },
    get itemToStringValue() {
      return props.itemToStringValue;
    },
    get isItemEqualToValue() {
      return isItemEqualToValue();
    },
    get openMethod() {
      return renderedOpenMethod();
    },
  });

  const rootPropsContextValue: SelectRootPropsContextValue = {
    disabled,
    readOnly,
    required,
    multiple,
    highlightItemOnHover,
    itemProps,
  };

  const inputRef = (el: HTMLInputElement | null) => {
    applyRef(props.inputRef, el);
    applyRef(validation.inputRef, el);
  };

  const hiddenInputName = () => (multiple() ? undefined : name());

  const hiddenInputExtraProps = createMemo(() =>
    validation.getValidationProps(disabled(), {
      onFocus() {
        // Move focus to the trigger element when the hidden input is focused.
        store.state.triggerElement?.focus({
          // Supported in Chrome from 144 (January 2026)
          focusVisible: true,
        } as FocusOptions);
      },
      // Handle browser autofill.
      onChange(event: Event) {
        if (event.defaultPrevented || untrack(disabled) || untrack(readOnly)) {
          return;
        }

        const nextValue = (event.currentTarget as HTMLInputElement).value;
        const details = createChangeEventDetails(REASONS.none, event);

        function handleChange() {
          if (untrack(multiple)) {
            // Browser autofill only writes a single scalar value.
            return;
          }

          // Preserve the original serialized matching, then fall back to rendered text,
          // which browsers can autofill for primitive values like
          // `value="US">United States`.
          const nextValueLower = nextValue.toLowerCase();
          const itemToStringValue = untrack(() => props.itemToStringValue);
          const itemToStringLabel = untrack(() => props.itemToStringLabel);
          let matchingIndex = valuesRef.current.findIndex(
            (candidate) =>
              stringifyAsValue(candidate, itemToStringValue).toLowerCase() === nextValueLower ||
              stringifyAsLabel(candidate, itemToStringLabel).toLowerCase() === nextValueLower,
          );

          if (matchingIndex === -1) {
            matchingIndex = valuesRef.current.findIndex((_, index) => {
              const renderedLabel = labelsRef.current[index];
              return renderedLabel != null && renderedLabel.toLowerCase() === nextValueLower;
            });
          }

          const matchingValue = valuesRef.current[matchingIndex];
          if (matchingValue != null) {
            // `setValue` may be canceled by `onValueChange`; rely on `useValueChanged` to
            // mark the field dirty and run validation only when the value actually changes.
            setValue(matchingValue, details);
          }
        }

        store.set('forceMount', true);
        queueMicrotask(handleChange);
      },
    }),
  );

  return (
    <SelectRootContext value={store}>
      <SelectRootPropsContext value={rootPropsContextValue}>
        <SelectFloatingContext value={floatingContext}>
          <IsolateChildren>{props.children}</IsolateChildren>
        </SelectFloatingContext>
      </SelectRootPropsContext>
      <input
        {...hiddenInputExtraProps()}
        id={generatedId() && hiddenInputName() == null ? `${generatedId()}-hidden-input` : undefined}
        form={props.form}
        name={hiddenInputName()}
        autocomplete={props.autoComplete}
        value={serializedValue()}
        disabled={disabled()}
        required={required() && !(multiple() && hasSelectedValue())}
        readonly={readOnly()}
        ref={inputRef}
        style={name() ? visuallyHiddenInput : visuallyHidden}
        tabindex={-1}
        aria-hidden="true"
      />
      <Show when={multiple() && Array.isArray(value()) && name()}>
        <For each={value() as any[]}>
          {(currentValue) => (
            <input
              type="hidden"
              form={props.form}
              name={name()}
              value={stringifyAsValue(currentValue, props.itemToStringValue)}
              disabled={disabled()}
            />
          )}
        </For>
      </Show>
    </SelectRootContext>
  );
}

type SelectValueType<Value, Multiple extends boolean | undefined> = Multiple extends true
  ? Value[]
  : Value;

export interface SelectRootProps<Value, Multiple extends boolean | undefined = false> {
  children?: JSX.Element;
  /**
   * A ref to access the hidden input element.
   */
  inputRef?: RefInput<HTMLInputElement> | undefined;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the hidden input.
   * Useful when the select is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * Provides a hint to the browser for autofill.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete
   */
  autoComplete?: string | undefined;
  /**
   * The id of the Select.
   */
  id?: string | undefined;
  /**
   * Whether the user must choose a value before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Whether the user should be unable to choose a different option from the select popup.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether multiple items can be selected.
   * @default false
   */
  multiple?: Multiple | undefined;
  /**
   * Whether moving the pointer over items should highlight them.
   * Disabling this prop allows CSS `:hover` to be differentiated from the `:focus` (`data-highlighted`) state.
   * @default true
   */
  highlightItemOnHover?: boolean | undefined;
  /**
   * Whether the select popup is initially open.
   *
   * To render a controlled select popup, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Event handler called when the select popup is opened or closed.
   */
  onOpenChange?: ((open: boolean, eventDetails: SelectRootChangeEventDetails) => void) | undefined;
  /**
   * Event handler called after any animations complete when the select popup is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * Whether the select popup is currently open.
   */
  open?: boolean | undefined;
  /**
   * Determines if the select enters a modal state when open.
   * - `true`: user interaction is limited to the select: document page scroll is locked and pointer interactions on outside elements are disabled.
   * - `false`: user interaction with the rest of the document is allowed.
   *
   * On touch devices, a `true` modal blocks outside taps but leaves the page scrollable unless the popup spans nearly the full viewport width, matching native iOS behavior.
   * @default true
   */
  modal?: boolean | undefined;
  /**
   * A ref to imperative actions.
   * - `unmount`: Manually unmounts the select.
   * Call this after any externally controlled closing animation finishes.
   */
  actionsRef?: RefObject<SelectRootActions | null> | undefined;
  /**
   * Data structure of the items rendered in the select popup.
   * When specified, `<Select.Value>` renders the label of the selected item instead of the raw value.
   * @example
   * ```tsx
   * const items = {
   *   sans: 'Sans-serif',
   *   serif: 'Serif',
   *   mono: 'Monospace',
   *   cursive: 'Cursive',
   * };
   * <Select.Root items={items} />
   * ```
   */
  items?:
    | Record<string, JSX.Element>
    | ReadonlyArray<{ label: JSX.Element; value: any }>
    | ReadonlyArray<Group<any>>
    | undefined;
  /**
   * When the item values are objects (`<Select.Item value={object}>`), this function converts the object value to a string representation for display in the trigger.
   * If the shape of the object is `{ value, label }`, the label will be used automatically without needing to specify this prop.
   */
  itemToStringLabel?: ((itemValue: Value) => string) | undefined;
  /**
   * When the item values are objects (`<Select.Item value={object}>`), this function converts the object value to a string representation for form submission.
   * If the shape of the object is `{ value, label }`, the value will be used automatically without needing to specify this prop.
   */
  itemToStringValue?: ((itemValue: Value) => string) | undefined;
  /**
   * Custom comparison logic used to determine if a select item value matches the current selected value. Useful when item values are objects without matching referentially.
   * Defaults to `Object.is` comparison.
   */
  isItemEqualToValue?: ((itemValue: Value, value: Value) => boolean) | undefined;
  /**
   * The uncontrolled value of the select when it's initially rendered.
   *
   * To render a controlled select, use the `value` prop instead.
   */
  defaultValue?: SelectValueType<Value, Multiple> | null | undefined;
  /**
   * The value of the select. Use when controlled.
   */
  value?: SelectValueType<Value, Multiple> | null | undefined;
  /**
   * Event handler called when the value of the select changes.
   */
  onValueChange?:
    | ((
        value: SelectValueType<Value, Multiple> | (Multiple extends true ? never : null),
        eventDetails: SelectRootChangeEventDetails,
      ) => void)
    | undefined;
}

export interface SelectRootState {}

export interface SelectRootActions {
  unmount: () => void;
}

export type SelectRootChangeEventReason =
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.escapeKey
  | typeof REASONS.windowResize
  | typeof REASONS.itemPress
  | typeof REASONS.focusOut
  | typeof REASONS.listNavigation
  | typeof REASONS.cancelOpen
  | typeof REASONS.none;

export type SelectRootChangeEventDetails = BaseUIChangeEventDetails<SelectRootChangeEventReason>;

export namespace SelectRoot {
  export type Props<Value, Multiple extends boolean | undefined = false> = SelectRootProps<
    Value,
    Multiple
  >;
  export type State = SelectRootState;
  export type Actions = SelectRootActions;
  export type ChangeEventReason = SelectRootChangeEventReason;
  export type ChangeEventDetails = SelectRootChangeEventDetails;
}
