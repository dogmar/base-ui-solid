import { omit, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { FloatingPortal } from '../../floating-ui-react';
import { type BaseUIComponentProps } from '../../internals/types';
import { useSelectRootContext } from '../root/SelectRootContext';
import type { RefObject } from '../../solid-utils/refs';

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectPortal(portalProps: SelectPortal.Props): JSX.Element {
  const otherProps = omit(portalProps, 'children');

  const store = useSelectRootContext();
  const mounted = store.useState('mounted');
  const forceMount = store.useState('forceMount');

  const shouldRender = () => mounted() || forceMount();

  // The portal stays mounted and the open/close gate lives inside its
  // children (see the note in `TooltipPortal`). Deviation from React: the
  // (empty) portal element remains in the DOM while the select is closed,
  // instead of being removed with the whole portal.
  return (
    <FloatingPortal {...otherProps}>
      <Show when={shouldRender()}>{portalProps.children}</Show>
    </FloatingPortal>
  );
}

export interface SelectPortalState {}

export interface SelectPortalProps extends BaseUIComponentProps<'div', SelectPortalState> {
  /**
   * A parent element to render the portal element into.
   */
  container?:
    HTMLElement | ShadowRoot | RefObject<HTMLElement | ShadowRoot | null> | null | undefined;
}

export namespace SelectPortal {
  export type State = SelectPortalState;
  export type Props = SelectPortalProps;
}
