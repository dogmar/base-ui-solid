import { omit } from 'solid-js';
import { useButton } from '../internals/use-button/useButton';
import { useRenderElement } from '../internals/useRenderElement';
import type { BaseUIComponentProps, NativeButtonProps } from '../internals/types';

/**
 * A button component that can be used to trigger actions.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Button](https://base-ui.com/react/components/button)
 */
export function Button(componentProps: Button.Props) {
  const elementProps = omit(
    componentProps,
    'render',
    'className',
    'class',
    'disabled',
    'focusableWhenDisabled',
    'nativeButton',
    'style',
    'ref',
  );

  const disabled = () => componentProps.disabled ?? false;

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return disabled();
    },
    get focusableWhenDisabled() {
      return componentProps.focusableWhenDisabled ?? false;
    },
    get native() {
      return componentProps.nativeButton ?? true;
    },
  });

  const state: ButtonState = {
    get disabled() {
      return disabled();
    },
  };

  return useRenderElement('button', componentProps, {
    state,
    ref: [componentProps.ref, buttonRef],
    props: [elementProps, getButtonProps],
  });
}

export interface ButtonState {
  /**
   * Whether the button should ignore user interaction.
   */
  disabled: boolean;
}

export interface ButtonProps
  extends NativeButtonProps, BaseUIComponentProps<'button', ButtonState> {
  /**
   * Whether the component should ignore user interaction.
   * Redeclared over the JSX attribute type (`boolean | ""`) to keep the
   * React-identical `boolean` API surface.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the button should be focusable when disabled.
   * @default false
   */
  focusableWhenDisabled?: boolean | undefined;
}

export namespace Button {
  export type State = ButtonState;
  export type Props = ButtonProps;
}
