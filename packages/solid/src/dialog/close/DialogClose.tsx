import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useDialogRootContext } from '../root/DialogRootContext';
import { useRenderElement } from '../../internals/useRenderElement';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';

/**
 * A button that closes the dialog.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Dialog](https://base-ui.com/react/components/dialog)
 */
export function DialogClose(componentProps: DialogClose.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'className',
    'class',
    'style',
    'ref',
    'disabled',
    'nativeButton',
  );

  const store = useDialogRootContext();

  const disabled = () => componentProps.disabled ?? false;

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return disabled();
    },
    get native() {
      return componentProps.nativeButton ?? true;
    },
  });

  const state: DialogCloseState = {
    get disabled() {
      return disabled();
    },
  };

  function handleClick(event: MouseEvent) {
    if (store.select('open')) {
      store.setOpen(false, createChangeEventDetails(REASONS.closePress, event));
    }
  }

  return useRenderElement('button', componentProps, {
    state,
    ref: [buttonRef],
    props: [{ onClick: handleClick }, elementProps, getButtonProps],
  });
}

export interface DialogCloseProps
  extends NativeButtonProps, BaseUIComponentProps<'button', DialogCloseState> {
  /**
   * Whether the button is currently disabled.
   * @default false
   */
  disabled?: boolean | undefined;
}

export interface DialogCloseState {
  /**
   * Whether the button is currently disabled.
   */
  disabled: boolean;
}

export namespace DialogClose {
  export type Props = DialogCloseProps;
  export type State = DialogCloseState;
}
