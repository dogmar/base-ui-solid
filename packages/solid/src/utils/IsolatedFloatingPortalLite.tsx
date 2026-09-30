/* eslint-disable react/jsx-fragments */
import { createRenderEffect, createSignal, omit, Show, untrack } from 'solid-js';
import { Portal, type JSX } from '@solidjs/web';
import { type BaseUIComponentProps, type HTMLProps } from '../internals/types';
import {
  useRenderElement,
  type UseRenderElementComponentProps,
} from '../internals/useRenderElement';
import { useBaseUiId } from '../internals/useBaseUiId';
import { createRef, type RefObject } from '../solid-utils/refs';
import { IsolateChildren } from '../solid-utils/isolateChildren';
import { usePortalContext } from '../floating-ui-react/components/FloatingPortal';

type PortalContainer = HTMLElement | ShadowRoot | RefObject<HTMLElement | ShadowRoot | null> | null;

const attr = 'data-base-ui-portal';

function isNode(value: unknown): value is Node {
  return typeof Node === 'function' && value instanceof Node;
}

/**
 * A fork of the committed `FloatingPortalLite` whose portal element render
 * thunk is wrapped in `IsolateChildren`.
 *
 * The committed `useFloatingPortalNode` hands `useRenderElement`'s bare render
 * thunk to `<Portal>`, whose insertion effect resolves it directly. A render
 * thunk builds a fresh element (and a fresh set of owned computations) on
 * every call, so once anything invalidates that insertion effect it disposes
 * the computations it tracked on the previous run and re-creates them —
 * re-triggering itself indefinitely. Isolating the thunk in its own memo makes
 * re-resolutions return the cached element and breaks the cycle.
 *
 * Used by popup components in place of `FloatingPortalLite` until the
 * committed helper gains the same isolation.
 * @internal
 */
export function IsolatedFloatingPortalLite(
  componentProps: IsolatedFloatingPortalLite.Props<any>,
): JSX.Element {
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

  const uniqueId = useBaseUiId();
  const portalContext = usePortalContext();

  const [containerElement, setContainerElement] = createSignal<HTMLElement | ShadowRoot | null>(
    null,
    { ownedWrite: true },
  );
  const [portalNode, setPortalNode] = createSignal<HTMLElement | null>(null, { ownedWrite: true });
  const setPortalNodeRef = (node: HTMLElement | null) => {
    if (node !== null) {
      // The render effect below watching `container` sets `setPortalNode(null)`
      // when the container becomes null, so ignoring null here is safe.
      setPortalNode(node);
    }
  };

  const containerRef = createRef<HTMLElement | ShadowRoot>();

  createRenderEffect(
    () => ({
      containerProp: componentProps.container,
      parentPortalNode: portalContext?.portalNode() ?? null,
    }),
    ({ containerProp, parentPortalNode }) => {
      const clear = () => {
        if (containerRef.current) {
          containerRef.current = null;
          setPortalNode(null);
          setContainerElement(null);
        }
      };

      // Wait for the container to be resolved if explicitly `null`.
      if (containerProp === null) {
        clear();
        return;
      }

      const resolvedContainer =
        (containerProp && (isNode(containerProp) ? containerProp : containerProp.current)) ??
        parentPortalNode ??
        document.body;

      if (resolvedContainer == null) {
        clear();
        return;
      }

      if (containerRef.current !== resolvedContainer) {
        containerRef.current = resolvedContainer as HTMLElement | ShadowRoot;
        setContainerElement(resolvedContainer as HTMLElement | ShadowRoot);
      }
    },
  );

  const portalElement = useRenderElement(
    'div',
    componentProps as UseRenderElementComponentProps<any>,
    {
      ref: [componentProps.ref, setPortalNodeRef],
      props: [
        {
          get id() {
            return uniqueId();
          },
          [attr]: '',
        },
        elementProps as HTMLProps<HTMLDivElement>,
      ],
    },
  );

  // Resolved once and cached, so the `Portal` insertion effect never re-creates it.
  const isolatedPortalElement = untrack(() => (
    <IsolateChildren>{portalElement}</IsolateChildren>
  ));

  return (
    <>
      <Show when={containerElement()}>
        {(container) => <Portal mount={container() as HTMLElement}>{isolatedPortalElement}</Portal>}
      </Show>
      <Show when={portalNode()}>
        {(node) => (
          <Portal mount={node()}>
            <IsolateChildren>{componentProps.children}</IsolateChildren>
          </Portal>
        )}
      </Show>
    </>
  );
}

export interface IsolatedFloatingPortalLiteState {}

export interface IsolatedFloatingPortalLiteProps<TState>
  extends BaseUIComponentProps<'div', TState> {
  container?: PortalContainer | undefined;
}

export namespace IsolatedFloatingPortalLite {
  export type State = IsolatedFloatingPortalLiteState;
  export type Props<TState> = IsolatedFloatingPortalLiteProps<TState>;
}
