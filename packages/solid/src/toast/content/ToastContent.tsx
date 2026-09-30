import { omit, onSettled } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import { useToastRootContext } from '../root/ToastRootContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { createRef } from '../../solid-utils/refs';

/**
 * A container for the contents of a toast.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastContent(componentProps: ToastContent.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'className', 'class', 'style', 'ref');

  const ctx = useToastRootContext();

  const contentRef = createRef<HTMLDivElement>();

  onSettled(() => {
    ctx.recalculateHeight();

    const node = contentRef.current;
    if (!node || typeof ResizeObserver !== 'function' || typeof MutationObserver !== 'function') {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(() => ctx.recalculateHeight(true));
    const mutationObserver = new MutationObserver(() => ctx.recalculateHeight(true));

    resizeObserver.observe(node);
    mutationObserver.observe(node, { childList: true, subtree: true, characterData: true });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  });

  const state: ToastContentState = {
    get expanded() {
      return ctx.expanded;
    },
    get behind() {
      return ctx.visibleIndex > 0;
    },
  };

  return useRenderElement('div', componentProps, {
    ref: [componentProps.ref, contentRef],
    state,
    props: [elementProps],
  });
}

export interface ToastContentState {
  /**
   * Whether the toast viewport is expanded.
   */
  expanded: boolean;
  /**
   * Whether the toast is behind the frontmost toast in the stack.
   */
  behind: boolean;
}

export interface ToastContentProps extends BaseUIComponentProps<'div', ToastContentState> {}

export namespace ToastContent {
  export type State = ToastContentState;
  export type Props = ToastContentProps;
}
