import { createSignal, omit, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { useToastRootContext } from '../root/ToastRootContext';
import { useToastProviderContext } from '../provider/ToastProviderContext';
import { useButton } from '../../internals/use-button/useButton';
import { useRenderElement } from '../../internals/useRenderElement';

/**
 * Closes the toast when clicked.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastClose(componentProps: ToastClose.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'className',
    'class',
    'style',
    'disabled',
    'nativeButton',
    'ref',
  );

  const store = useToastProviderContext();
  const ctx = useToastRootContext();

  const [hasFocus, setHasFocus] = createSignal(false, { ownedWrite: true });

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return componentProps.disabled;
    },
    get native() {
      return componentProps.nativeButton ?? true;
    },
  });

  const state: ToastCloseState = {
    get type() {
      return ctx.toast.type;
    },
  };

  return useRenderElement('button', componentProps, {
    ref: [componentProps.ref, buttonRef],
    state,
    props: [
      {
        get 'aria-hidden'() {
          return !ctx.expanded && !hasFocus() ? 'true' : 'false';
        },
        onClick() {
          store.closeToast(untrack(() => ctx.toast.id));
        },
        onFocus() {
          setHasFocus(true);
        },
        onBlur() {
          setHasFocus(false);
        },
      },
      elementProps,
      getButtonProps,
    ],
  });
}

export interface ToastCloseState {
  /**
   * The type of the toast.
   */
  type: string | undefined;
}

export interface ToastCloseProps
  extends NativeButtonProps, BaseUIComponentProps<'button', ToastCloseState> {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled?: boolean | undefined;
}

export namespace ToastClose {
  export type State = ToastCloseState;
  export type Props = ToastCloseProps;
}
