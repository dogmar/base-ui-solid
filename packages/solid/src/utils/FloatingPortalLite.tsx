import { omit, Show } from 'solid-js';
import { Portal, type JSX } from '@solidjs/web';
import { type BaseUIComponentProps, type HTMLProps } from '../internals/types';
import type { RefObject } from '../solid-utils/refs';
import { useFloatingPortalNode } from '../floating-ui-react/components/FloatingPortal';

type PortalContainer = HTMLElement | ShadowRoot | RefObject<HTMLElement | ShadowRoot | null> | null;

/**
 * `FloatingPortal` includes tabbable logic handling for focus management.
 * For components that don't need tabbable logic, use `FloatingPortalLite`.
 * @internal
 */
export function FloatingPortalLite(componentProps: FloatingPortalLite.Props<any>): JSX.Element {
  const elementProps = omit(
    componentProps,
    'children',
    'container',
    'className',
    'class',
    'render',
    'style',
    'ref',
  );

  const { node: portalNode, subtree: portalSubtree } = useFloatingPortalNode({
    get container() {
      return componentProps.container;
    },
    get ref() {
      return componentProps.ref;
    },
    componentProps,
    elementProps: elementProps as HTMLProps<HTMLDivElement>,
  });

  return (
    <>
      {portalSubtree}
      <Show when={portalNode()}>
        {(node) => <Portal mount={node()}>{componentProps.children}</Portal>}
      </Show>
    </>
  );
}

export interface FloatingPortalLiteState {}

export interface FloatingPortalLiteProps<TState> extends BaseUIComponentProps<'div', TState> {
  container?: PortalContainer | undefined;
}

export namespace FloatingPortalLite {
  export type State = FloatingPortalLiteState;
  export type Props<TState> = FloatingPortalLiteProps<TState>;
}
