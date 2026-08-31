import { createEffect, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { error } from '@base-ui/utils/error';
import { useControlled } from '../solid-utils/useControlled';
import { useBaseUiId } from '../internals/useBaseUiId';
import { useRenderElement } from '../internals/useRenderElement';
import type { BaseUIComponentProps, NativeButtonProps } from '../internals/types';
import { useToggleGroupContext } from '../toggle-group/ToggleGroupContext';
import { useButton } from '../internals/use-button/useButton';
import { CompositeItem } from '../internals/composite/item/CompositeItem';
import { applyRef, type Ref } from '../solid-utils/refs';
import {
  type BaseUIChangeEventDetails,
  createChangeEventDetails,
} from '../internals/createBaseUIEventDetails';
import { REASONS } from '../internals/reasons';

/**
 * A two-state button that can be on or off.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Toggle](https://base-ui.com/react/components/toggle)
 */
export function Toggle<Value extends string>(componentProps: Toggle.Props<Value>): JSX.Element {
  const elementProps = omit(
    componentProps,
    'className',
    'class',
    'defaultPressed',
    'disabled',
    'form',
    'onPressedChange',
    'pressed',
    'render',
    'type',
    'value',
    'nativeButton',
    'style',
    'ref',
  );

  // `|| undefined` handles cases, where value is falsy (i.e. "")
  const value = useBaseUiId(() => componentProps.value || undefined);
  const groupContext = useToggleGroupContext<string>();
  const groupValue = () => groupContext?.value() ?? [];

  const disabled = () => (componentProps.disabled || groupContext?.disabled()) ?? false;
  const nativeButton = () => componentProps.nativeButton ?? true;

  if (process.env.NODE_ENV !== 'production') {
    createEffect(
      () => ({
        valueProp: componentProps.value,
        isValueInitialized: groupContext?.isValueInitialized(),
      }),
      (current) => {
        if (groupContext && current.valueProp === undefined && current.isValueInitialized) {
          error(
            'A `<Toggle>` component rendered in a `<ToggleGroup>` has no explicit `value` prop.',
            'This will cause issues between the Toggle Group and Toggle values.',
            'Provide the `<Toggle>` with a `value` prop matching the `<ToggleGroup>` values prop type.',
          );
        }
      },
    );
  }

  const [pressed, setPressedState] = useControlled({
    controlled: () =>
      groupContext
        ? value() !== undefined && groupValue().indexOf(value()!) > -1
        : componentProps.pressed,
    default: componentProps.defaultPressed ?? false,
    name: 'Toggle',
    state: 'pressed',
  });

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return disabled();
    },
    get native() {
      return nativeButton();
    },
  });

  const state: ToggleState = {
    get disabled() {
      return disabled();
    },
    get pressed() {
      return pressed() ?? false;
    },
  };

  const refs: Ref<HTMLElement>[] = [
    buttonRef,
    (el: HTMLElement | null) => applyRef(componentProps.ref, el),
  ];
  const props = [
    {
      get 'aria-pressed'() {
        // Solid renders boolean attribute values as presence/absence; aria
        // attributes need explicit strings.
        return pressed() ? 'true' : 'false';
      },
      onClick(event: MouseEvent) {
        const nextPressed = !pressed();
        const details = createChangeEventDetails(REASONS.none, event);

        // `onPressedChange` runs before the group commits so that canceling here
        // can also veto the group value change, which shares this `details` object.
        componentProps.onPressedChange?.(nextPressed, details);

        if (details.isCanceled) {
          return;
        }

        const currentValue = value();
        if (currentValue) {
          groupContext?.setGroupValue?.(currentValue, nextPressed, details);
        }

        if (details.isCanceled) {
          return;
        }

        setPressedState(nextPressed);
      },
    },
    elementProps,
    getButtonProps,
  ];

  // A disabled toggle is natively disabled and cannot hold roving focus.
  // Toolbar reads this metadata to compute its `disabledIndices`.
  // (The object is stable; `disabled` is exposed through a reactive getter.)
  const itemMetadata: ToggleItemMetadata = {
    get disabled() {
      return disabled();
    },
    focusableWhenDisabled: false,
  };

  // Context presence is fixed for the lifetime of the component, so this is a
  // static branch (not a reactive condition).
  if (groupContext) {
    return (
      <CompositeItem
        tag="button"
        render={componentProps.render}
        className={componentProps.className}
        class={componentProps.class}
        style={componentProps.style}
        metadata={itemMetadata}
        state={state}
        refs={refs}
        props={props}
      />
    );
  }

  return useRenderElement('button', componentProps, {
    state,
    ref: refs,
    props,
  });
}

/**
 * Composite item metadata published by a `Toggle` rendered inside a group.
 * Mirrors `ToolbarRoot.ItemMetadata` from the React package; move it there
 * once the toolbar subsystem is ported.
 */
interface ToggleItemMetadata {
  disabled: boolean;
  focusableWhenDisabled: boolean;
}

export interface ToggleState {
  /**
   * Whether the toggle is currently pressed.
   */
  pressed: boolean;
  /**
   * Whether the toggle should ignore user interaction.
   */
  disabled: boolean;
}

export interface ToggleProps<Value extends string>
  extends NativeButtonProps, BaseUIComponentProps<'button', ToggleState> {
  /**
   * Whether the toggle button is currently pressed.
   * This is the controlled counterpart of `defaultPressed`.
   */
  pressed?: boolean | undefined;
  /**
   * Whether the toggle button is currently pressed.
   * This is the uncontrolled counterpart of `pressed`.
   * @default false
   */
  defaultPressed?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Callback fired when the pressed state is changed.
   */
  onPressedChange?:
    ((pressed: boolean, eventDetails: Toggle.ChangeEventDetails) => void) | undefined;
  /**
   * A unique string that identifies the toggle when used
   * inside a toggle group.
   */
  value?: Value | undefined;
}

export type ToggleChangeEventReason = typeof REASONS.none;

export type ToggleChangeEventDetails = BaseUIChangeEventDetails<Toggle.ChangeEventReason>;

export namespace Toggle {
  export type State = ToggleState;
  export type Props<TValue extends string = string> = ToggleProps<TValue>;
  export type ChangeEventReason = ToggleChangeEventReason;
  export type ChangeEventDetails = ToggleChangeEventDetails;
}
