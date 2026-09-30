import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useDialogRootContext } from '../root/DialogRootContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { type TransitionStatus } from '../../internals/useTransitionStatus';
import { type BaseUIComponentProps } from '../../internals/types';
import { popupTransitionStateMapping } from '../../utils/popupStateMapping';

/**
 * An overlay displayed beneath the popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Dialog](https://base-ui.com/react/components/dialog)
 */
export function DialogBackdrop(componentProps: DialogBackdrop.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'className',
    'class',
    'style',
    'ref',
    'forceRender',
  );

  const store = useDialogRootContext();

  const open = store.useState('open');
  const nested = store.useState('nested');
  const mounted = store.useState('mounted');
  const transitionStatus = store.useState('transitionStatus');

  const state: DialogBackdropState = {
    get open() {
      return open();
    },
    get transitionStatus() {
      return transitionStatus();
    },
  };

  return useRenderElement('div', componentProps, {
    state,
    ref: [store.context.backdropRef],
    stateAttributesMapping: popupTransitionStateMapping,
    props: [
      {
        role: 'presentation' as const,
        get hidden() {
          return !mounted();
        },
        style: {
          'user-select': 'none',
          '-webkit-user-select': 'none',
        },
      },
      elementProps,
    ],
    enabled: () => (componentProps.forceRender ?? false) || !nested(),
  });
}

export interface DialogBackdropProps extends BaseUIComponentProps<'div', DialogBackdropState> {
  /**
   * Whether the backdrop is forced to render even when nested.
   * @default false
   */
  forceRender?: boolean | undefined;
}

export interface DialogBackdropState {
  /**
   * Whether the dialog is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export namespace DialogBackdrop {
  export type Props = DialogBackdropProps;
  export type State = DialogBackdropState;
}
