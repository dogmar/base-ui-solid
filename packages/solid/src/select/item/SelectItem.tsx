import { createRenderEffect, omit, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useSelectRootContext, useSelectRootPropsContext } from '../root/SelectRootContext';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import type {
  BaseUIComponentProps,
  HTMLProps,
  NonNativeButtonProps,
} from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { SelectItemContext } from './SelectItemContext';
import { useButton } from '../../internals/use-button';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { compareItemEquality, removeItem } from '../../internals/itemEquality';
import { isVirtualClick } from '../../floating-ui-react/utils/event';
import { mergeProps } from '../../merge-props';
import { createRef } from '../../solid-utils/refs';
import { IsolateChildren } from '../../solid-utils/isolateChildren';

/**
 * An individual option in the select popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectItem(componentProps: SelectItem.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'className',
    'class',
    'style',
    'value',
    'label',
    'disabled',
    'nativeButton',
    'ref',
  );

  const itemValue = () => componentProps.value ?? null;

  const textRef = createRef<HTMLElement>();
  const listItem = useCompositeListItem({
    guess: true,
    get label() {
      return componentProps.label;
    },
    textRef,
  });

  const store = useSelectRootContext();
  const rootProps = useSelectRootPropsContext();
  const disabled = () => rootProps.disabled() || (componentProps.disabled ?? false);
  const highlighted = store.useState('isActive', listItem.index);
  const open = store.useState('open');
  const selected = store.useState('isSelected', itemValue);
  const selectedByFocus = store.useState('isSelectedByFocus', listItem.index);
  const isItemEqualToValue = store.useState('isItemEqualToValue');

  const index = listItem.index;

  const itemRef = createRef<HTMLDivElement>();

  createRenderEffect(
    () => ({ index: index(), itemValue: itemValue() }),
    (current) => {
      const values = store.context.valuesRef.current;
      values[current.index] = current.itemValue;

      return () => {
        delete values[current.index];
      };
    },
  );

  createRenderEffect(
    () => ({
      index: index(),
      multiple: rootProps.multiple(),
      isItemEqualToValue: isItemEqualToValue(),
      itemValue: itemValue(),
    }),
    (current) => {
      const selectedValue = store.state.value;

      let selectedCandidate = selectedValue;
      if (current.multiple && Array.isArray(selectedValue)) {
        // Compare against the last selected item, or `undefined` when nothing is selected — never
        // the raw array, which a custom `isItemEqualToValue` isn't expected to receive.
        selectedCandidate =
          selectedValue.length > 0 ? selectedValue[selectedValue.length - 1] : undefined;
      }

      if (
        selectedCandidate !== undefined &&
        compareItemEquality(current.itemValue, selectedCandidate, current.isItemEqualToValue)
      ) {
        store.set('selectedIndex', current.index);
        // Make sure SelectPopup can measure the selected item on first open.
        // SelectItemText can still update this ref later when focus moves.
        if (textRef.current) {
          store.context.selectedItemTextRef.current = textRef.current;
        }
      }
    },
  );

  const pointerTypeRef = { current: 'mouse' as 'mouse' | 'touch' | 'pen' };
  const allowMouseSelectionRef = { current: false };

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return disabled();
    },
    focusableWhenDisabled: true,
    get native() {
      return componentProps.nativeButton ?? false;
    },
    composite: true,
  });

  const state: SelectItemState = {
    get disabled() {
      return disabled();
    },
    get selected() {
      return selected();
    },
    get highlighted() {
      return highlighted();
    },
  };

  function commitSelection(event: MouseEvent | KeyboardEvent | PointerEvent) {
    // A forced-open select (`open`/`defaultOpen`) can still receive item activations even
    // when the root is disabled or read-only, so guard the commit here too.
    if (untrack(() => rootProps.disabled()) || untrack(() => rootProps.readOnly())) {
      return;
    }

    const selectedValue = store.state.value;
    if (untrack(() => rootProps.multiple())) {
      const currentValue = Array.isArray(selectedValue) ? selectedValue : [];
      const nextValue = untrack(selected)
        ? removeItem(currentValue, untrack(itemValue), untrack(isItemEqualToValue))
        : [...currentValue, untrack(itemValue)];
      store.context.setValue(nextValue, createChangeEventDetails(REASONS.itemPress, event));
    } else {
      store.context.setValue(untrack(itemValue), createChangeEventDetails(REASONS.itemPress, event));
      store.context.setOpen(false, createChangeEventDetails(REASONS.itemPress, event));
    }
  }

  function resetDragMovement() {
    store.context.selectionRef.current.dragY = 0;
  }

  const defaultProps: HTMLProps = {
    role: 'option',
    get 'aria-selected'() {
      return selected() ? 'true' : 'false';
    },
    get tabindex() {
      return open() && highlighted() ? 0 : -1;
    },
    onKeyDown(event: KeyboardEvent) {
      store.set('activeIndex', untrack(index));

      if (event.key === ' ' && store.context.typingRef.current) {
        // `useButton` skips Space activation for `role="option"` items when the keydown
        // is `defaultPrevented`, keeping typeahead spaces from committing a selection.
        event.preventDefault();
      }
    },
    onClick(event: MouseEvent) {
      const isMouseClick = pointerTypeRef.current !== 'touch';
      const clickPointerType = (event as PointerEvent).pointerType;
      const isVirtualMouseClick =
        isMouseClick &&
        isVirtualClick(event) &&
        // Generic no-pointer `detail === 0` clicks stay tied to highlight state. Virtual
        // clicks that carry browser pointer data, including an empty string from assistive
        // technology, can activate unhighlighted items.
        (clickPointerType !== undefined || untrack(highlighted));
      // With alignItemWithTrigger, opening can place an item under the cursor. Real mouse
      // clicks must start on the item, while virtual clicks represent explicit keyboard or
      // assistive technology activation.
      const isInvalidMouseClick =
        isMouseClick && !isVirtualMouseClick && !allowMouseSelectionRef.current;

      allowMouseSelectionRef.current = false;

      if (untrack(disabled) || isInvalidMouseClick) {
        return;
      }

      commitSelection(event);
    },
    onPointerEnter(event: PointerEvent) {
      pointerTypeRef.current = event.pointerType as 'mouse' | 'touch' | 'pen';
    },
    onPointerMove(event: PointerEvent) {
      if (event.pointerType === 'mouse' && event.buttons === 1) {
        const selection = store.context.selectionRef.current;
        selection.dragY += event.movementY;

        if (selection.dragY ** 2 >= 64) {
          selection.allowUnselectedMouseUp = true;
        }
      }
    },
    onPointerDown(event: PointerEvent) {
      pointerTypeRef.current = event.pointerType as 'mouse' | 'touch' | 'pen';
      allowMouseSelectionRef.current = true;
      resetDragMovement();
    },
    onMouseUp() {
      resetDragMovement();

      if (untrack(disabled) || pointerTypeRef.current === 'touch') {
        return;
      }

      // Regular clicks are committed by the click event.
      if (allowMouseSelectionRef.current) {
        return;
      }

      const disallowSelectedMouseUp =
        !store.context.selectionRef.current.allowSelectedMouseUp && untrack(selected);
      const disallowUnselectedMouseUp =
        !store.context.selectionRef.current.allowUnselectedMouseUp && !untrack(selected);

      if (disallowSelectedMouseUp || disallowUnselectedMouseUp) {
        return;
      }

      allowMouseSelectionRef.current = true;
      itemRef.current?.click();
      allowMouseSelectionRef.current = false;
    },
  };

  const contextValue: SelectItemContext = {
    selected,
    index,
    textRef,
    selectedByFocus,
  };

  return (
    <SelectItemContext value={contextValue}>
      <IsolateChildren>
        {useRenderElement('div', componentProps, {
          ref: [buttonRef, listItem.ref, itemRef],
          state,
          props: [
            (merged) => mergeProps(merged, rootProps.itemProps()),
            defaultProps,
            elementProps,
            getButtonProps,
          ],
        })}
      </IsolateChildren>
    </SelectItemContext>
  );
}

export interface SelectItemState {
  /**
   * Whether the item should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the item is selected.
   */
  selected: boolean;
  /**
   * Whether the item is highlighted.
   */
  highlighted: boolean;
}

export interface SelectItemProps
  extends NonNativeButtonProps, Omit<BaseUIComponentProps<'div', SelectItemState>, 'id'> {
  children?: JSX.Element;
  /**
   * A unique value that identifies this select item.
   * @default null
   */
  value?: any;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Specifies the text label to use when the item is matched during keyboard text navigation.
   *
   * Defaults to the item text content if not provided.
   */
  label?: string | undefined;
}

export namespace SelectItem {
  export type State = SelectItemState;
  export type Props = SelectItemProps;
}
