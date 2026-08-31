import { createEffect, createSignal, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { addEventListener } from '@base-ui/utils/addEventListener';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { contains, getTarget } from '../../floating-ui-react/utils';
import { useScrollAreaRootContext } from '../root/ScrollAreaRootContext';
import { ScrollAreaScrollbarContext } from './ScrollAreaScrollbarContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { getOffset } from '../utils/getOffset';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { scrollAreaStateAttributesMapping } from '../root/stateAttributes';
import type { ScrollAreaRootState } from '../root/ScrollAreaRoot';
import type { RefCallback } from '../../solid-utils/refs';
import * as ScrollAreaRootCssVars from '../root/ScrollAreaRootCssVars';
import * as ScrollAreaScrollbarCssVars from './ScrollAreaScrollbarCssVars';

/**
 * A vertical or horizontal scrollbar for the scroll area.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Scroll Area](https://base-ui.com/react/components/scroll-area)
 */
export function ScrollAreaScrollbar(componentProps: ScrollAreaScrollbar.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'className',
    'class',
    'orientation',
    'keepMounted',
    'style',
    'ref',
  );

  const context = useScrollAreaRootContext();

  const orientation = () => componentProps.orientation ?? 'vertical';
  const keepMounted = () => componentProps.keepMounted ?? false;
  const vertical = () => orientation() === 'vertical';

  const state: ScrollAreaScrollbarState = {
    get scrolling() {
      return vertical() ? context.scrollingY() : context.scrollingX();
    },
    get hasOverflowX() {
      return context.viewportState.hasOverflowX;
    },
    get hasOverflowY() {
      return context.viewportState.hasOverflowY;
    },
    get overflowXStart() {
      return context.viewportState.overflowXStart;
    },
    get overflowXEnd() {
      return context.viewportState.overflowXEnd;
    },
    get overflowYStart() {
      return context.viewportState.overflowYStart;
    },
    get overflowYEnd() {
      return context.viewportState.overflowYEnd;
    },
    get cornerHidden() {
      return context.viewportState.cornerHidden;
    },
    get hovering() {
      return context.hovering();
    },
    get orientation() {
      return orientation();
    },
  };

  const direction = useDirection();
  const hideTrackUntilMeasured = () => !context.hasMeasuredScrollbar() && !keepMounted();
  const isHidden = () => (vertical() ? context.hiddenState().y : context.hiddenState().x);
  const shouldRender = () => keepMounted() || !isHidden();

  // Tracks the rendered scrollbar element reactively so the wheel listener
  // re-registers when the scrollbar mounts or remounts.
  const [scrollbarElement, setScrollbarElement] = createSignal<HTMLDivElement | null>(null, {
    ownedWrite: true,
  });

  const mergedScrollbarRef: RefCallback<HTMLDivElement> = (element) => {
    if (vertical()) {
      context.scrollbarYRef.current = element;
    } else {
      context.scrollbarXRef.current = element;
    }
    setScrollbarElement(element);
  };

  createEffect(
    () => [shouldRender() ? scrollbarElement() : null, direction(), vertical()] as const,
    ([scrollbarEl, currentDirection, currentVertical]) => {
      if (!scrollbarEl) {
        return undefined;
      }

      const viewportEl = context.viewportRef.current;

      function handleWheel(event: WheelEvent) {
        if (!viewportEl || event.ctrlKey) {
          return;
        }

        const horizontal = !currentVertical;
        const scrollProperty = horizontal ? 'scrollLeft' : 'scrollTop';
        const delta = horizontal ? event.deltaX : event.deltaY;
        if (delta === 0) {
          return;
        }

        const maxScroll = horizontal
          ? viewportEl.scrollWidth - viewportEl.clientWidth
          : viewportEl.scrollHeight - viewportEl.clientHeight;
        // RTL horizontal scrolling uses a negative `scrollLeft` range, from 0 to `-maxScroll`.
        const minScroll = horizontal && currentDirection === 'rtl' ? -maxScroll : 0;
        const maxScrollValue = horizontal && currentDirection === 'rtl' ? 0 : maxScroll;
        const scrollValue = viewportEl[scrollProperty];

        // At an edge (or with no overflow), let the wheel event chain to the
        // parent/page instead of swallowing it via `preventDefault`.
        if (
          (scrollValue <= minScroll && delta < 0) ||
          (scrollValue >= maxScrollValue && delta > 0)
        ) {
          return;
        }

        event.preventDefault();

        viewportEl[scrollProperty] = Math.min(
          maxScrollValue,
          Math.max(minScroll, scrollValue + delta),
        );

        context.handleScroll({ x: viewportEl.scrollLeft, y: viewportEl.scrollTop });
      }

      return addEventListener(scrollbarEl, 'wheel', handleWheel, { passive: false });
    },
  );

  const props: HTMLProps = {
    get 'data-id'() {
      const rootId = context.rootId();
      return rootId ? `${rootId}-scrollbar` : undefined;
    },
    'aria-hidden': 'true',
    onPointerDown(event: PointerEvent) {
      if (event.button !== 0) {
        return;
      }

      const target = getTarget(event) as Element | null;
      const thumbEl = vertical() ? context.thumbYRef.current : context.thumbXRef.current;

      // Ignore clicks on the thumb, including cases where the event is
      // retargeted to the track host across a shadow boundary.
      if (thumbEl && contains(thumbEl, target)) {
        return;
      }

      const viewportEl = context.viewportRef.current;
      if (!viewportEl) {
        return;
      }

      const scrollbarEl = vertical()
        ? context.scrollbarYRef.current
        : context.scrollbarXRef.current;

      if (!thumbEl || !scrollbarEl) {
        return;
      }

      const axis = vertical() ? 'y' : 'x';
      const thumbOffset = getOffset(thumbEl, 'margin', axis);
      const scrollbarOffset = getOffset(scrollbarEl, 'padding', axis);
      const thumbSizePx = vertical() ? thumbEl.offsetHeight : thumbEl.offsetWidth;
      const trackRect = scrollbarEl.getBoundingClientRect();
      const clickPosition = vertical()
        ? event.clientY - trackRect.top - thumbSizePx / 2 - scrollbarOffset + thumbOffset / 2
        : event.clientX - trackRect.left - thumbSizePx / 2 - scrollbarOffset + thumbOffset / 2;

      const scrollableSize = vertical() ? viewportEl.scrollHeight : viewportEl.scrollWidth;
      const viewportSize = vertical() ? viewportEl.clientHeight : viewportEl.clientWidth;
      const trackSize = vertical() ? scrollbarEl.offsetHeight : scrollbarEl.offsetWidth;

      const maxThumbOffset = trackSize - thumbSizePx - scrollbarOffset - thumbOffset;
      // A short or heavily padded track can drive `maxThumbOffset` to zero or
      // negative once the thumb hits its `MIN_THUMB_SIZE` floor. Dividing by it
      // would yield a non-finite (`Infinity`/`NaN`) or inverted scroll position.
      if (maxThumbOffset <= 0) {
        return;
      }

      const scrollRatio = clickPosition / maxThumbOffset;
      const maxScrollDistance = scrollableSize - viewportSize;

      // Disable snapping before the jump-to-click assignment, or the
      // assigned position quantizes to the nearest snap point and the thumb
      // stays offset from the pointer for the whole drag. `handlePointerDown`
      // below re-runs this as a guarded no-op for the thumb-drag path.
      context.disableViewportSnap();

      if (vertical()) {
        viewportEl.scrollTop = scrollRatio * maxScrollDistance;
      } else if (direction() === 'rtl') {
        viewportEl.scrollLeft = -(1 - scrollRatio) * maxScrollDistance;
      } else {
        viewportEl.scrollLeft = scrollRatio * maxScrollDistance;
      }

      context.handleScroll({ x: viewportEl.scrollLeft, y: viewportEl.scrollTop });

      context.handlePointerDown(event);
    },
    // Native scrollbars don't move focus when pressed, whichever button is used.
    // Handled here rather than on the thumb so the bubbled press covers both.
    onMouseDown(event: MouseEvent) {
      event.preventDefault();
    },
    onPointerUp: context.handlePointerUp,
    // Mirror `onPointerUp` so a browser-cancelled gesture on the track (no thumb
    // child captures the pointer) still clears the drag state.
    onPointerCancel: context.handlePointerUp,
    get style() {
      const style: JSX.CSSProperties = {
        position: 'absolute',
        'touch-action': 'none',
        '-webkit-user-select': 'none',
        'user-select': 'none',
      };

      if (hideTrackUntilMeasured()) {
        style.visibility = 'hidden';
      }

      if (vertical()) {
        style.top = '0';
        style.bottom = `var(${ScrollAreaRootCssVars.scrollAreaCornerHeight})`;
        style['inset-inline-end'] = '0';
        style[ScrollAreaScrollbarCssVars.scrollAreaThumbHeight] = `${context.thumbSize().height}px`;
      } else {
        style['inset-inline-start'] = '0';
        style['inset-inline-end'] = `var(${ScrollAreaRootCssVars.scrollAreaCornerWidth})`;
        style.bottom = '0';
        style[ScrollAreaScrollbarCssVars.scrollAreaThumbWidth] = `${context.thumbSize().width}px`;
      }

      return style;
    },
  };

  return (
    <ScrollAreaScrollbarContext value={orientation}>
      {useRenderElement('div', componentProps, {
        enabled: shouldRender,
        ref: mergedScrollbarRef,
        state,
        props: [props, elementProps],
        stateAttributesMapping: scrollAreaStateAttributesMapping,
      })}
    </ScrollAreaScrollbarContext>
  );
}

export interface ScrollAreaScrollbarState extends ScrollAreaRootState {
  /**
   * Whether the scroll area is being hovered.
   */
  hovering: boolean;
  /**
   * Whether the scroll area is being scrolled.
   */
  scrolling: boolean;
  /**
   * The orientation of the scrollbar.
   */
  orientation: 'vertical' | 'horizontal';
}

export interface ScrollAreaScrollbarProps extends BaseUIComponentProps<
  'div',
  ScrollAreaScrollbarState
> {
  /**
   * Whether the scrollbar controls vertical or horizontal scroll.
   * @default 'vertical'
   */
  orientation?: 'vertical' | 'horizontal' | undefined;
  /**
   * Whether to keep the HTML element in the DOM when the viewport isn't scrollable.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace ScrollAreaScrollbar {
  export type State = ScrollAreaScrollbarState;
  export type Props = ScrollAreaScrollbarProps;
}
