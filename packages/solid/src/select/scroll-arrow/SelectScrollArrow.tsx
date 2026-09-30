import { omit, onCleanup, untrack, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { useSelectRootContext } from '../root/SelectRootContext';
import { useSelectPositionerContext } from '../positioner/SelectPositionerContext';
import { Side } from '../../internals/useAnchorPositioning';
import { type TransitionStatus, useTransitionStatus } from '../../internals/useTransitionStatus';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useRenderElement } from '../../internals/useRenderElement';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import {
  getMaxScrollOffset,
  normalizeScrollOffset,
  SCROLL_EDGE_TOLERANCE_PX,
} from '../../utils/scrollEdges';
import { useTimeout } from '../../solid-utils/timers';

/**
 * @internal
 */
export function SelectScrollArrow(componentProps: SelectScrollArrow.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'className',
    'class',
    'style',
    'direction',
    'keepMounted',
    'ref',
  );

  const isUp = () => componentProps.direction === 'up';

  const store = useSelectRootContext();
  const { side, scrollDownArrowRef, scrollUpArrowRef } = useSelectPositionerContext();

  const stateVisibleUp = store.useState('scrollUpArrowVisible');
  const stateVisibleDown = store.useState('scrollDownArrowVisible');
  const stateVisible = () => (isUp() ? stateVisibleUp() : stateVisibleDown());
  const openMethod = store.useState('openMethod');

  // Scroll arrows are disabled for touch modality as they are a hover-only element.
  const visible = () => stateVisible() && openMethod() !== 'touch';

  const timeout = useTimeout();

  const scrollArrowRef = untrack(isUp) ? scrollUpArrowRef : scrollDownArrowRef;

  const { mounted, transitionStatus, setMounted } = useTransitionStatus(visible);

  store.context.scrollArrowsMountedCountRef.current += 1;
  store.set('hasScrollArrows', true);
  onCleanup(() => {
    store.context.scrollArrowsMountedCountRef.current = Math.max(
      0,
      store.context.scrollArrowsMountedCountRef.current - 1,
    );
    if (store.context.scrollArrowsMountedCountRef.current === 0) {
      store.set('hasScrollArrows', false);
    }
  });

  useOpenChangeComplete({
    get open() {
      return visible();
    },
    ref: scrollArrowRef,
    onComplete() {
      if (!untrack(visible)) {
        setMounted(false);
      }
    },
  });

  const state: SelectScrollArrowState = {
    get direction() {
      return componentProps.direction;
    },
    get visible() {
      return visible();
    },
    get side() {
      return side();
    },
    get transitionStatus() {
      return transitionStatus();
    },
  };

  const defaultProps: HTMLProps = {
    'aria-hidden': 'true',
    children: untrack(isUp) ? '▲' : '▼',
    style: {
      position: 'absolute',
    },
    onMouseMove(event: MouseEvent) {
      if ((event.movementX === 0 && event.movementY === 0) || timeout.isStarted()) {
        return;
      }

      store.set('activeIndex', null);

      function scrollNextItem() {
        const scroller = store.state.listElement ?? store.context.popupRef.current;
        if (!scroller) {
          return;
        }

        store.set('activeIndex', null);
        store.context.handleScrollArrowVisibility(scroller);

        const maxScrollTop = getMaxScrollOffset(scroller.scrollHeight, scroller.clientHeight);
        const scrollTop = normalizeScrollOffset(scroller.scrollTop, maxScrollTop);
        const isScrolledToEdge = scrollTop === (untrack(isUp) ? 0 : maxScrollTop);
        const items = store.context.listRef.current;

        if (scrollTop !== scroller.scrollTop) {
          scroller.scrollTop = scrollTop;
        }

        if (isScrolledToEdge) {
          timeout.clear();
          return;
        }

        if (items.length > 0) {
          const scrollArrowHeight = scrollArrowRef.current?.offsetHeight || 0;
          scroller.scrollTop = getTargetScrollTop(
            items,
            untrack(isUp),
            scrollTop,
            scroller.clientHeight,
            scrollArrowHeight,
            maxScrollTop,
          );
        }

        timeout.start(40, scrollNextItem);
      }

      timeout.start(40, scrollNextItem);
    },
    onMouseLeave() {
      timeout.clear();
    },
  };

  const element = useRenderElement('div', componentProps, {
    ref: [scrollArrowRef],
    state,
    props: [defaultProps, elementProps],
    stateAttributesMapping: transitionStatusMapping,
  });

  return <Show when={mounted() || (componentProps.keepMounted ?? false)}>{element}</Show>;
}

export interface SelectScrollArrowState {
  /**
   * The direction of the element.
   */
  direction: 'up' | 'down';
  /**
   * Whether the element is visible.
   */
  visible: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side | 'none';
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface SelectScrollArrowProps extends BaseUIComponentProps<
  'div',
  SelectScrollArrowState
> {
  direction: 'up' | 'down';
  /**
   * Whether to keep the HTML element in the DOM while the select popup is not scrollable.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace SelectScrollArrow {
  export type State = SelectScrollArrowState;
  export type Props = SelectScrollArrowProps;
}

function getTargetScrollTop(
  items: Array<HTMLElement | null>,
  isUp: boolean,
  scrollTop: number,
  clientHeight: number,
  scrollArrowHeight: number,
  maxScrollTop: number,
) {
  if (isUp) {
    let firstVisibleIndex = 0;
    const visibleTop = scrollTop + scrollArrowHeight - SCROLL_EDGE_TOLERANCE_PX;

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item && item.offsetTop >= visibleTop) {
        firstVisibleIndex = i;
        break;
      }
    }

    const targetIndex = Math.max(0, firstVisibleIndex - 1);
    const targetItem = items[targetIndex];
    return targetIndex < firstVisibleIndex && targetItem
      ? normalizeScrollOffset(targetItem.offsetTop - scrollArrowHeight, maxScrollTop)
      : 0;
  }

  let lastVisibleIndex = items.length - 1;
  const visibleBottom = scrollTop + clientHeight - scrollArrowHeight + SCROLL_EDGE_TOLERANCE_PX;

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (item && item.offsetTop + item.offsetHeight > visibleBottom) {
      lastVisibleIndex = Math.max(0, i - 1);
      break;
    }
  }

  const targetIndex = Math.min(items.length - 1, lastVisibleIndex + 1);
  const targetItem = items[targetIndex];
  return targetIndex > lastVisibleIndex && targetItem
    ? normalizeScrollOffset(
        targetItem.offsetTop + targetItem.offsetHeight - clientHeight + scrollArrowHeight,
        maxScrollTop,
      )
    : maxScrollTop;
}
