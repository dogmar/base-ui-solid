import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useRenderElement } from '../../internals/useRenderElement';
import { type BaseUIComponentProps } from '../../internals/types';
import { type TransitionStatus } from '../../internals/useTransitionStatus';
import { useDialogRootContext } from '../root/DialogRootContext';
import { useDialogPortalContext } from '../portal/DialogPortalContext';
import { dialogStateAttributesMapping } from '../utils/stateAttributesMapping';

/**
 * A positioning container for the dialog popup that can be made scrollable.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Dialog](https://base-ui.com/react/components/dialog)
 */
export function DialogViewport(componentProps: DialogViewport.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'className',
    'class',
    'style',
    'ref',
    'children',
  );

  const keepMounted = useDialogPortalContext();
  const store = useDialogRootContext();

  const open = store.useState('open');
  const nested = store.useState('nested');
  const transitionStatus = store.useState('transitionStatus');
  const nestedOpenDialogCount = store.useState('nestedOpenDialogCount');
  const mounted = store.useState('mounted');

  const setViewportElement = store.useStateSetter('viewportElement');

  const nestedDialogOpen = () => nestedOpenDialogCount() > 0;

  const state: DialogViewportState = {
    get open() {
      return open();
    },
    get nested() {
      return nested();
    },
    get transitionStatus() {
      return transitionStatus();
    },
    get nestedDialogOpen() {
      return nestedDialogOpen();
    },
  };

  const shouldRender = () => keepMounted() || mounted();

  return useRenderElement('div', componentProps, {
    enabled: shouldRender,
    state,
    ref: [setViewportElement],
    stateAttributesMapping: dialogStateAttributesMapping,
    props: [
      {
        role: 'presentation' as const,
        get hidden() {
          return !mounted();
        },
        get style() {
          return {
            'pointer-events': !open() ? ('none' as const) : undefined,
          };
        },
        get children() {
          return componentProps.children;
        },
      },
      elementProps,
    ],
  });
}

export interface DialogViewportState {
  /**
   * Whether the dialog is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * Whether the dialog is nested within another dialog.
   */
  nested: boolean;
  /**
   * Whether the dialog has nested dialogs open.
   */
  nestedDialogOpen: boolean;
}

export interface DialogViewportProps extends BaseUIComponentProps<'div', DialogViewportState> {}

export namespace DialogViewport {
  export type State = DialogViewportState;
  export type Props = DialogViewportProps;
}
