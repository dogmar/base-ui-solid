import { omit, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { FloatingPortal } from '../../floating-ui-react';
import { type BaseUIComponentProps } from '../../internals/types';
import { useDialogRootContext } from '../root/DialogRootContext';
import { DialogPortalContext } from './DialogPortalContext';
import { InternalBackdrop } from '../../utils/InternalBackdrop';
import type { RefObject } from '../../solid-utils/refs';

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Dialog](https://base-ui.com/react/components/dialog)
 */
export function DialogPortal(props: DialogPortal.Props): JSX.Element {
  const portalProps = omit(props, 'keepMounted', 'children');

  const store = useDialogRootContext();
  const mounted = store.useState('mounted');
  const modal = store.useState('modal');
  const open = store.useState('open');

  const keepMounted = () => props.keepMounted ?? false;
  const shouldRender = () => mounted() || keepMounted();

  // The portal stays mounted and the open/close gate lives inside its
  // children (see the note in `TooltipPortal`). Deviation from React: the
  // (empty) portal element remains in the DOM while the dialog is closed,
  // instead of being removed with the whole portal. The `keepMounted` context
  // provider sits inside the portal rather than around it: an element-less
  // provider directly wrapping `FloatingPortal` gets deep-resolved in a single
  // isolating memo by the Root's children isolation, which re-creates the
  // portal element on its own insertion signals and loops.
  return (
    <FloatingPortal {...portalProps}>
      <DialogPortalContext value={keepMounted}>
        <Show when={shouldRender()}>
          <Show when={mounted() && modal() === true}>
            <InternalBackdrop ref={store.context.internalBackdropRef} inert={!open()} />
          </Show>
          {props.children}
        </Show>
      </DialogPortalContext>
    </FloatingPortal>
  );
}

export interface DialogPortalState {}

export interface DialogPortalProps extends BaseUIComponentProps<'div', DialogPortalState> {
  /**
   * Whether to keep the portal mounted in the DOM while the popup is hidden.
   * @default false
   */
  keepMounted?: boolean | undefined;
  /**
   * A parent element to render the portal element into.
   */
  container?:
    | HTMLElement
    | ShadowRoot
    | RefObject<HTMLElement | ShadowRoot | null>
    | null
    | undefined;
}

export namespace DialogPortal {
  export type State = DialogPortalState;
  export type Props = DialogPortalProps;
}
