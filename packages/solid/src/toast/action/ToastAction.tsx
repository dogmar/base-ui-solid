import { children as resolveChildren, createMemo, omit, untrack, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps, HTMLProps, NativeButtonProps } from '../../internals/types';
import { useToastRootContext } from '../root/ToastRootContext';
import { useButton } from '../../internals/use-button/useButton';
import { useRenderElement } from '../../internals/useRenderElement';
import { mergeProps } from '../../merge-props';
import { isRenderableNode } from '../utils/isRenderableNode';

/**
 * Performs an action when clicked.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastAction(componentProps: ToastAction.Props): JSX.Element {
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

  const ctx = useToastRootContext();

  const renderProp = untrack(() => componentProps.render);
  // Snapshot the render element's own children before `useRenderElement`
  // replaces them, so a childless content fallback can restore them.
  const renderOwnChildren: Node[] =
    renderProp instanceof Element ? Array.from(renderProp.childNodes) : [];

  const computedChildren = () => ctx.toast.actionProps?.children ?? componentProps.children;

  const childrenThunk = (() => {
    const value = computedChildren();
    if (isRenderableNode(value)) {
      return value;
    }
    return renderOwnChildren.length > 0 ? (renderOwnChildren as unknown as JSX.Element) : value;
  }) as unknown as JSX.Element;

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return componentProps.disabled;
    },
    get native() {
      return componentProps.nativeButton ?? true;
    },
  });

  const state: ToastActionState = {
    get type() {
      return ctx.toast.type;
    },
  };

  const element = useRenderElement('button', componentProps, {
    ref: [componentProps.ref, buttonRef],
    state,
    props: [
      elementProps,
      (props: HTMLProps) => mergeProps(props, (ctx.toast.actionProps ?? {}) as HTMLProps),
      getButtonProps,
      {
        get children() {
          return childrenThunk;
        },
      },
    ],
  });

  const resolved = resolveChildren(() => element);

  const shouldRender = createMemo(() => {
    if (isRenderableNode(computedChildren())) {
      return true;
    }
    if (renderOwnChildren.length > 0) {
      return true;
    }
    if (typeof renderProp === 'function') {
      const nodes = resolved.toArray();
      return nodes.some((node) =>
        node instanceof Element ? node.childNodes.length > 0 : isRenderableNode(node),
      );
    }
    return false;
  });

  return <Show when={shouldRender()}>{resolved()}</Show>;
}

export interface ToastActionState {
  /**
   * The type of the toast.
   */
  type: string | undefined;
}

export interface ToastActionProps
  extends NativeButtonProps, BaseUIComponentProps<'button', ToastActionState> {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled?: boolean | undefined;
}

export namespace ToastAction {
  export type State = ToastActionState;
  export type Props = ToastActionProps;
}
