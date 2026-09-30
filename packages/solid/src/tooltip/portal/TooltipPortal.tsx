import { omit, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useTooltipRootContext } from '../root/TooltipRootContext';
import { TooltipPortalContext } from './TooltipPortalContext';
import { IsolatedFloatingPortalLite } from '../../utils/IsolatedFloatingPortalLite';
import { type BaseUIComponentProps } from '../../internals/types';
import type { RefObject } from '../../solid-utils/refs';

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Tooltip](https://base-ui.com/react/components/tooltip)
 */
export function TooltipPortal(props: TooltipPortal.Props): JSX.Element {
  const portalProps = omit(props, 'keepMounted', 'children');

  const store = useTooltipRootContext();
  const mounted = store.useState('mounted');

  const keepMounted = () => props.keepMounted ?? false;
  const shouldRender = () => mounted() || keepMounted();

  // The portal stays mounted and the open/close gate lives inside its
  // children, matching the committed `FloatingPortal` usage pattern: the
  // toggle is then handled by the portal's own isolated insertion effect and
  // never changes this component's in-tree value (which would re-resolve —
  // and re-create — sibling elements in the surrounding insertion scope).
  // Deviation from React: the (empty) portal element remains in the DOM while
  // the tooltip is closed, instead of being removed with the whole portal.
  return (
    <TooltipPortalContext value={keepMounted}>
      <IsolatedFloatingPortalLite {...portalProps}>
        <Show when={shouldRender()}>{props.children}</Show>
      </IsolatedFloatingPortalLite>
    </TooltipPortalContext>
  );
}

export interface TooltipPortalState {}

export interface TooltipPortalProps extends BaseUIComponentProps<'div', TooltipPortalState> {
  /**
   * Whether to keep the portal mounted in the DOM while the popup is hidden.
   * @default false
   */
  keepMounted?: boolean | undefined;
  /**
   * A parent element to render the portal element into.
   */
  container?: HTMLElement | ShadowRoot | RefObject<HTMLElement | ShadowRoot | null> | null | undefined;
}

export namespace TooltipPortal {
  export type State = TooltipPortalState;
  export type Props = TooltipPortalProps;
}
