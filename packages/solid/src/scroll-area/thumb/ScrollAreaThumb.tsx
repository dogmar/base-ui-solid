import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { useScrollAreaRootContext } from '../root/ScrollAreaRootContext';
import { useScrollAreaScrollbarContext } from '../scrollbar/ScrollAreaScrollbarContext';
import { useRenderElement } from '../../internals/useRenderElement';
import type { RefCallback } from '../../solid-utils/refs';

/**
 * The draggable part of the scrollbar that indicates the current scroll position.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Scroll Area](https://base-ui.com/react/components/scroll-area)
 */
export function ScrollAreaThumb(componentProps: ScrollAreaThumb.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'className', 'class', 'style', 'ref');

  const context = useScrollAreaRootContext();

  const orientation = useScrollAreaScrollbarContext();
  const vertical = () => orientation() === 'vertical';

  const state: ScrollAreaThumbState = {
    get scrolling() {
      return vertical() ? context.scrollingY() : context.scrollingX();
    },
    get orientation() {
      return orientation();
    },
  };

  const mergedThumbRef: RefCallback<HTMLDivElement> = (element) => {
    if (vertical()) {
      context.thumbYRef.current = element;
    } else {
      context.thumbXRef.current = element;
    }
  };

  const props: HTMLProps = {
    onPointerDown: context.handlePointerDown,
    onPointerMove: context.handlePointerMove,
    onPointerUp: context.handlePointerUp,
    onPointerCancel: context.handlePointerUp,
    get style() {
      const style: JSX.CSSProperties = vertical()
        ? { height: 'var(--scroll-area-thumb-height)' }
        : { width: 'var(--scroll-area-thumb-width)' };

      if (!context.hasMeasuredScrollbar()) {
        style.visibility = 'hidden';
      }

      return style;
    },
  };

  return useRenderElement('div', componentProps, {
    ref: mergedThumbRef,
    state,
    props: [props, elementProps],
  });
}

export interface ScrollAreaThumbState {
  /**
   * Whether the scroll area is being scrolled.
   */
  scrolling: boolean;
  /**
   * The component orientation.
   */
  orientation: 'horizontal' | 'vertical';
}

export interface ScrollAreaThumbProps extends BaseUIComponentProps<'div', ScrollAreaThumbState> {}

export namespace ScrollAreaThumb {
  export type State = ScrollAreaThumbState;
  export type Props = ScrollAreaThumbProps;
}
