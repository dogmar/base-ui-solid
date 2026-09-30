import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { useScrollAreaRootContext } from '../root/ScrollAreaRootContext';
import { useRenderElement } from '../../internals/useRenderElement';

/**
 * A small rectangular area that appears at the intersection of horizontal and vertical scrollbars.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Scroll Area](https://base-ui.com/react/components/scroll-area)
 */
export function ScrollAreaCorner(componentProps: ScrollAreaCorner.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'className', 'class', 'style', 'ref');

  const context = useScrollAreaRootContext();

  const props: HTMLProps = {
    'aria-hidden': 'true',
    get style() {
      const cornerSize = context.cornerSize();
      return {
        position: 'absolute',
        bottom: '0',
        'inset-inline-end': '0',
        width: `${cornerSize.width}px`,
        height: `${cornerSize.height}px`,
      } as JSX.CSSProperties;
    },
  };

  return useRenderElement('div', componentProps, {
    enabled: () => !context.hiddenState().corner,
    ref: context.cornerRef,
    props: [props, elementProps],
  });
}

export interface ScrollAreaCornerState {}

export interface ScrollAreaCornerProps extends BaseUIComponentProps<'div', ScrollAreaCornerState> {}

export namespace ScrollAreaCorner {
  export type State = ScrollAreaCornerState;
  export type Props = ScrollAreaCornerProps;
}
