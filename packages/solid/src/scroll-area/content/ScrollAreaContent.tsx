import { createEffect, createSignal, omit, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { useScrollAreaViewportContext } from '../viewport/ScrollAreaViewportContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { useScrollAreaRootContext } from '../root/ScrollAreaRootContext';
import { scrollAreaStateAttributesMapping } from '../root/stateAttributes';
import type { ScrollAreaRootState } from '../root/ScrollAreaRoot';
import type { RefCallback } from '../../solid-utils/refs';

/**
 * A container for the content of the scroll area.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Scroll Area](https://base-ui.com/react/components/scroll-area)
 */
export function ScrollAreaContent(componentProps: ScrollAreaContent.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'className', 'class', 'style', 'ref');

  const viewportContext = useScrollAreaViewportContext();
  const rootContext = useScrollAreaRootContext();

  const [contentWrapperElement, setContentWrapperElement] = createSignal<HTMLDivElement | null>(
    null,
    { ownedWrite: true },
  );
  const computeOnInitialResizeRef = untrack(() => rootContext.hasMeasuredScrollbar());

  const contentWrapperRef: RefCallback<HTMLDivElement> = (element) => {
    setContentWrapperElement(element);
  };

  createEffect(
    () => contentWrapperElement(),
    (contentWrapper) => {
      if (typeof ResizeObserver === 'undefined' || !contentWrapper) {
        return undefined;
      }

      let hasInitialized = false;
      const resizeObserver = new ResizeObserver(() => {
        if (!hasInitialized) {
          hasInitialized = true;

          // ResizeObserver fires once upon observing. Skip that initial call to avoid
          // double-calculating the thumb position on mount, unless the content mounted
          // after the viewport's initial measurement (in which case this fire is what
          // brings the overflow state in sync).
          if (!computeOnInitialResizeRef) {
            return;
          }
        }

        viewportContext.computeThumbPosition();
      });

      resizeObserver.observe(contentWrapper);

      return () => {
        resizeObserver.disconnect();
      };
    },
  );

  const props: HTMLProps = {
    role: 'presentation',
    style: {
      'min-width': 'fit-content',
    },
  };

  return useRenderElement('div', componentProps, {
    ref: contentWrapperRef,
    state: rootContext.viewportState,
    stateAttributesMapping: scrollAreaStateAttributesMapping,
    props: [props, elementProps],
  });
}

export interface ScrollAreaContentState extends ScrollAreaRootState {}

export interface ScrollAreaContentProps extends BaseUIComponentProps<
  'div',
  ScrollAreaContentState
> {}

export namespace ScrollAreaContent {
  export type State = ScrollAreaContentState;
  export type Props = ScrollAreaContentProps;
}
