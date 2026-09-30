import { createEffect, createRenderEffect, createSignal, omit, type Accessor } from 'solid-js';
import { Portal, type JSX } from '@solidjs/web';
import { isNode } from '@floating-ui/utils/dom';
import { addEventListener } from '@base-ui/utils/addEventListener';
import { mergeCleanups } from '@base-ui/utils/mergeCleanups';
import { EMPTY_OBJECT } from '@base-ui/utils/empty';
import { Show } from 'solid-js';
import { FocusGuard } from '../../utils/FocusGuard';
import {
  enableFocusInside,
  disableFocusInside,
  getPreviousTabbable,
  getNextTabbable,
  isOutsideEvent,
} from '../utils/tabbable';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { createAttribute } from '../utils/createAttribute';
import {
  useRenderElement,
  type UseRenderElementComponentProps,
} from '../../internals/useRenderElement';
import { ownerVisuallyHidden } from '../../internals/constants';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';
import { createRef, type RefInput, type RefObject } from '../../solid-utils/refs';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';

type FocusManagerState = null | {
  modal: boolean;
  open: boolean;
  onOpenChange(
    open: boolean,
    data?: { reason?: string | undefined; event?: Event | undefined },
  ): void;
  domReference: Element | null;
  closeOnFocusOut: boolean;
};

interface PortalContextValue {
  portalNode: Accessor<HTMLElement | null>;
  setFocusManagerState: (state: FocusManagerState) => void;
  beforeInsideRef: RefObject<HTMLSpanElement>;
  afterInsideRef: RefObject<HTMLSpanElement>;
  beforeOutsideRef: RefObject<HTMLSpanElement>;
  afterOutsideRef: RefObject<HTMLSpanElement>;
}

const PortalContext = createOptionalContext<PortalContextValue>();

export const usePortalContext = (): PortalContextValue | null =>
  useOptionalContext(PortalContext) ?? null;

const attr = createAttribute('portal');

export interface UseFloatingPortalNodeProps {
  ref?: RefInput<HTMLDivElement> | undefined;
  container?:
    | HTMLElement
    | ShadowRoot
    | null
    | RefObject<HTMLElement | ShadowRoot | null>
    | undefined;
  componentProps?: UseRenderElementComponentProps<any> | undefined;
  elementProps?: HTMLProps<HTMLDivElement> | undefined;
}

export interface UseFloatingPortalNodeResult {
  /**
   * The portal element once it has been mounted.
   */
  node: Accessor<HTMLElement | null>;
  /**
   * The `id` attribute of the portal node, read from the rendered DOM node so
   * `aria-owns` never points at an ID absent from the DOM.
   */
  nodeId: Accessor<string | undefined>;
  /**
   * The JSX subtree that renders the portal element into its container. Must
   * be included in the caller's returned JSX.
   */
  subtree: JSX.Element;
}

export function useFloatingPortalNode(
  props: UseFloatingPortalNodeProps = {},
): UseFloatingPortalNodeResult {
  const uniqueId = useBaseUiId();
  const portalContext = usePortalContext();

  const [containerElement, setContainerElement] = createSignal<HTMLElement | ShadowRoot | null>(
    null,
    { ownedWrite: true },
  );
  const [portalNode, setPortalNode] = createSignal<HTMLElement | null>(null, { ownedWrite: true });
  const setPortalNodeRef = (node: HTMLElement | null) => {
    if (node !== null) {
      // The render effect below watching `container` / parentPortalNode sets
      // setPortalNode(null) when the container becomes null. So even though
      // the ref callback ignores null, the portal node still gets cleared.
      setPortalNode(node);
    }
  };

  const containerRef = createRef<HTMLElement | ShadowRoot>();

  createRenderEffect(
    () => ({
      containerProp: props.container,
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
    props.componentProps ?? (EMPTY_OBJECT as UseRenderElementComponentProps<any>),
    {
      ref: [props.ref, setPortalNodeRef],
      props: [
        {
          get id() {
            return uniqueId();
          },
          [attr]: '',
        },
        props.elementProps,
      ],
    },
  );

  // This `Portal` injects `portalElement` into the container. Another `Portal`
  // inside `FloatingPortal`/`FloatingPortalLite` then injects the children
  // into `portalElement`.
  const portalSubtree = (
    <Show when={containerElement()}>
      {(container) => <Portal mount={container() as HTMLElement}>{portalElement}</Portal>}
    </Show>
  );

  return {
    node: portalNode,
    nodeId: () => portalNode()?.id || undefined,
    subtree: portalSubtree,
  };
}

/**
 * Portals the floating element into a given container element — by default,
 * outside of the app root and into the body.
 * This is necessary to ensure the floating element can appear outside any
 * potential parent containers that cause clipping (such as `overflow: hidden`),
 * while retaining its location in the component tree.
 * @see https://floating-ui.com/docs/FloatingPortal
 * @internal
 */
export function FloatingPortal(componentProps: FloatingPortal.Props<any>): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'className',
    'class',
    'style',
    'children',
    'container',
    'portalOwnerRole',
    'ref',
  );

  const {
    node: portalNode,
    nodeId: portalNodeId,
    subtree: portalSubtree,
  } = useFloatingPortalNode({
    get container() {
      return componentProps.container;
    },
    get ref() {
      return componentProps.ref;
    },
    componentProps,
    elementProps: elementProps as HTMLProps<HTMLDivElement>,
  });

  const beforeOutsideRef = createRef<HTMLSpanElement>();
  const afterOutsideRef = createRef<HTMLSpanElement>();
  const beforeInsideRef = createRef<HTMLSpanElement>();
  const afterInsideRef = createRef<HTMLSpanElement>();

  const [focusManagerState, setFocusManagerState] = createSignal<FocusManagerState>(null, {
    ownedWrite: true,
  });
  let focusInsideDisabled = false;

  const shouldRenderGuards = () => {
    const state = focusManagerState();
    return !!state && !state.modal && state.open && !!portalNode();
  };

  // https://codesandbox.io/s/tabbable-portal-f4tng?file=/src/TabbablePortal.tsx
  createEffect(
    () => ({ portalNode: portalNode(), modal: focusManagerState()?.modal }),
    ({ portalNode: node, modal }) => {
      if (!node || modal) {
        return undefined;
      }

      // Make sure elements inside the portal element are tabbable only when the
      // portal has already been focused, either by tabbing into a focus trap
      // element outside or using the mouse.
      function onFocus(event: FocusEvent) {
        if (node && event.relatedTarget && isOutsideEvent(event)) {
          if (event.type === 'focusin') {
            if (focusInsideDisabled) {
              enableFocusInside(node);
              focusInsideDisabled = false;
            }
          } else {
            disableFocusInside(node);
            focusInsideDisabled = true;
          }
        }
      }

      // Listen to the event on the capture phase so they run before the focus
      // trap elements onFocus prop is called.
      return mergeCleanups(
        addEventListener(node, 'focusin', onFocus, true),
        addEventListener(node, 'focusout', onFocus, true),
      );
    },
  );

  createRenderEffect(
    () => ({ open: focusManagerState()?.open, portalNode: portalNode() }),
    ({ open, portalNode: node }) => {
      if (!node || open !== true || !focusInsideDisabled) {
        return;
      }

      // Restore tabbability before the focus manager's queued focus-on-open step runs.
      enableFocusInside(node);
      focusInsideDisabled = false;
    },
  );

  const portalContextValue: PortalContextValue = {
    beforeOutsideRef,
    afterOutsideRef,
    beforeInsideRef,
    afterInsideRef,
    portalNode,
    setFocusManagerState,
  };

  return (
    <>
      {portalSubtree}
      <PortalContext value={portalContextValue}>
        <Show when={shouldRenderGuards() && portalNode()}>
          {(node) => (
            <FocusGuard
              data-type="outside"
              ref={beforeOutsideRef}
              onFocus={(event: FocusEvent) => {
                if (isOutsideEvent(event, node())) {
                  beforeInsideRef.current?.focus();
                } else {
                  const state = focusManagerState();
                  const domReference = state ? state.domReference : null;
                  const prevTabbable = getPreviousTabbable(domReference);
                  prevTabbable?.focus();
                }
              }}
            />
          )}
        </Show>
        <Show when={shouldRenderGuards() && portalNode()}>
          <span
            role={componentProps.portalOwnerRole}
            aria-owns={portalNodeId()}
            style={ownerVisuallyHidden}
          />
        </Show>
        <Show when={portalNode()}>
          {(node) => <Portal mount={node()}>{componentProps.children}</Portal>}
        </Show>
        <Show when={shouldRenderGuards() && portalNode()}>
          {(node) => (
            <FocusGuard
              data-type="outside"
              ref={afterOutsideRef}
              onFocus={(event: FocusEvent) => {
                if (isOutsideEvent(event, node())) {
                  afterInsideRef.current?.focus();
                } else {
                  const state = focusManagerState();
                  const domReference = state ? state.domReference : null;
                  const nextTabbable = getNextTabbable(domReference);
                  nextTabbable?.focus();

                  if (state?.closeOnFocusOut) {
                    state?.onOpenChange(
                      false,
                      createChangeEventDetails(REASONS.focusOut, event),
                    );
                  }
                }
              }}
            />
          )}
        </Show>
      </PortalContext>
    </>
  );
}

export interface FloatingPortalState {}

export namespace FloatingPortal {
  export type State = FloatingPortalState;
  export interface Props<TState> extends BaseUIComponentProps<'div', TState> {
    /**
     * A parent element to render the portal element into.
     */
    container?: UseFloatingPortalNodeProps['container'] | undefined;
    /**
     * @ignore
     * The role for the hidden `aria-owns` owner element.
     */
    portalOwnerRole?: JSX.AriaAttributes['role'] | undefined;
  }
}
