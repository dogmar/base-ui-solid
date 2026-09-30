/* eslint-disable react/jsx-fragments */
import { createEffect, createRenderEffect, omit, onCleanup, untrack, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { rectToClientRect } from '@floating-ui/utils';
import { addEventListener } from '@base-ui/utils/addEventListener';
import { platform } from '@base-ui/utils/platform';
import { ownerDocument, ownerWindow } from '@base-ui/utils/owner';
import type { InteractionType } from '@base-ui/utils/useEnhancedClickHandler';
import { clamp } from '@base-ui/utils/clamp';
import { FloatingFocusManager, platform as floatingPlatform } from '../../floating-ui-react';
import type { ClientRectObject } from '../../floating-ui-react';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import {
  useSelectFloatingContext,
  useSelectRootContext,
  useSelectRootPropsContext,
} from '../root/SelectRootContext';
import { popupStateMapping } from '../../utils/popupStateMapping';
import type { Side, Align } from '../../internals/useAnchorPositioning';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { useSelectPositionerContext } from '../positioner/SelectPositionerContext';
import { styleDisableScrollbar } from '../../utils/styles';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useRenderElement } from '../../internals/useRenderElement';
import { clearStyles, LIST_FUNCTIONAL_STYLES, type PositionerInlineStyles } from './utils';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useToolbarRootContext } from '../../toolbar/root/ToolbarRootContext';
import { COMPOSITE_KEYS } from '../../internals/composite/composite';
import { getDisabledMountTransitionStyles } from '../../internals/getDisabledMountTransitionStyles';
import { getMaxScrollOffset, SCROLL_EDGE_TOLERANCE_PX } from '../../utils/scrollEdges';
import { useCSPContext } from '../../internals/csp-context/CSPContext';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { mergeProps } from '../../merge-props';
import { useAnimationFrame } from '../../solid-utils/timers';
import { IsolateChildren } from '../../solid-utils/isolateChildren';
import type { RefObject } from '../../solid-utils/refs';
import * as SelectPositionerCssVars from '../positioner/SelectPositionerCssVars';

const stateAttributesMapping: StateAttributesMapping<SelectPopupState> = {
  ...popupStateMapping,
  ...transitionStatusMapping,
};

/**
 * A container for the select list.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectPopup(componentProps: SelectPopup.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'className',
    'class',
    'style',
    'finalFocus',
    'ref',
  );

  const store = useSelectRootContext();
  const { multiple, readOnly, highlightItemOnHover } = useSelectRootPropsContext();
  const floatingRootContext = useSelectFloatingContext();
  const positioner = useSelectPositionerContext();
  const {
    align,
    alignItemWithTriggerActive,
    isPositioned,
    setControlledAlignItemWithTrigger,
  } = positioner;
  const side = positioner.side;
  const insideToolbar = useToolbarRootContext(true) != null;
  const direction = useDirection();

  const { nonce, disableStyleElements } = useCSPContext();

  const id = store.useState('id');
  const open = store.useState('open');
  const openMethod = store.useState('openMethod');
  const mounted = store.useState('mounted');
  const popupProps = store.useState('popupProps');
  const transitionStatus = store.useState('transitionStatus');
  const triggerElement = store.useState('triggerElement');
  const positionerElement = store.useState('positionerElement');
  const listElement = store.useState('listElement');
  const reachedMaxHeightRef = { current: false };
  const initialPlacedRef = { current: false };
  const originalPositionerStylesRef: { current: PositionerInlineStyles } = { current: {} };

  const scrollArrowFrame = useAnimationFrame();

  const handleScroll = (scroller: HTMLDivElement) => {
    const currentPositionerElement = untrack(positionerElement);
    if (!currentPositionerElement || !store.context.popupRef.current || !initialPlacedRef.current) {
      return;
    }

    const isTopPositioned = currentPositionerElement.style.top === '0px';
    const isBottomPositioned = currentPositionerElement.style.bottom === '0px';

    if (
      reachedMaxHeightRef.current ||
      !untrack(alignItemWithTriggerActive) ||
      (!isTopPositioned && !isBottomPositioned)
    ) {
      store.context.handleScrollArrowVisibility(scroller);
      return;
    }

    const scale = getScale(currentPositionerElement);
    const currentHeight = normalizeSize(
      currentPositionerElement.getBoundingClientRect().height,
      'y',
      scale,
    );
    const doc = ownerDocument(currentPositionerElement);
    const win = ownerWindow(currentPositionerElement);
    const positionerStyles = win.getComputedStyle(currentPositionerElement);
    const marginTop = parseFloat(positionerStyles.marginTop);
    const marginBottom = parseFloat(positionerStyles.marginBottom);
    const maxPopupHeight = getMaxPopupHeight(win.getComputedStyle(store.context.popupRef.current));
    const maxAvailableHeight = Math.min(
      doc.documentElement.clientHeight - marginTop - marginBottom,
      maxPopupHeight,
    );

    const scrollTop = scroller.scrollTop;
    const maxScrollTop = getMaxScrollTop(scroller);

    // `Infinity` requests a scroll to the recomputed maximum offset.
    let nextScrollTop: number | null = null;

    const setHeight = (height: number) => {
      currentPositionerElement.style.height = `${height}px`;
    };

    const diff = isTopPositioned ? maxScrollTop - scrollTop : scrollTop;
    const nextHeight = Math.min(currentHeight + diff, maxAvailableHeight);

    if (diff <= SCROLL_EDGE_TOLERANCE_PX) {
      const heightDelta = clamp(diff, 0, maxAvailableHeight - currentHeight);
      if (heightDelta > 0) {
        // Consume the remaining scroll in height.
        setHeight(currentHeight + heightDelta);
      }
      scroller.scrollTop = isTopPositioned ? maxScrollTop : 0;
      if (maxAvailableHeight - (currentHeight + heightDelta) <= SCROLL_EDGE_TOLERANCE_PX) {
        reachedMaxHeightRef.current = true;
      }
      store.context.handleScrollArrowVisibility(scroller);
      return;
    }

    if (maxAvailableHeight - nextHeight > SCROLL_EDGE_TOLERANCE_PX) {
      nextScrollTop = isTopPositioned ? Infinity : 0;
    } else if (isBottomPositioned && scrollTop < maxScrollTop) {
      const overshoot = currentHeight + diff - maxAvailableHeight;
      nextScrollTop = scrollTop - (diff - overshoot);
    }

    const nextPositionerHeight = Math.ceil(nextHeight);

    if (nextPositionerHeight !== 0) {
      setHeight(nextPositionerHeight);
    }

    if (nextScrollTop != null) {
      // Recompute bounds after resizing (clientHeight likely changed).
      const target = clamp(nextScrollTop, 0, getMaxScrollTop(scroller));

      // Avoid adjustments that re-trigger scroll events forever.
      if (Math.abs(scroller.scrollTop - target) > SCROLL_EDGE_TOLERANCE_PX) {
        scroller.scrollTop = target;
      }
    }

    if (nextPositionerHeight >= maxAvailableHeight - SCROLL_EDGE_TOLERANCE_PX) {
      reachedMaxHeightRef.current = true;
    }

    store.context.handleScrollArrowVisibility(scroller);
  };

  store.context.scrollHandlerRef.current = handleScroll;
  onCleanup(() => {
    if (store.context.scrollHandlerRef.current === handleScroll) {
      store.context.scrollHandlerRef.current = null;
    }
  });

  useOpenChangeComplete({
    get open() {
      return open();
    },
    ref: store.context.popupRef,
    onComplete() {
      if (untrack(open)) {
        store.context.onOpenChangeComplete(true);
      }
    },
  });

  const state: SelectPopupState = {
    get open() {
      return open();
    },
    get transitionStatus() {
      return transitionStatus();
    },
    get side() {
      return side();
    },
    get align() {
      return align();
    },
  };

  createRenderEffect(
    () => positionerElement(),
    (currentPositionerElement) => {
      if (
        !currentPositionerElement ||
        !store.context.popupRef.current ||
        Object.keys(originalPositionerStylesRef.current).length
      ) {
        return;
      }

      originalPositionerStylesRef.current = {
        top: currentPositionerElement.style.top || '0',
        left: currentPositionerElement.style.left || '0',
        right: currentPositionerElement.style.right,
        height: currentPositionerElement.style.height,
        bottom: currentPositionerElement.style.bottom,
        minHeight: currentPositionerElement.style.minHeight,
        maxHeight: currentPositionerElement.style.maxHeight,
        marginTop: currentPositionerElement.style.marginTop,
        marginBottom: currentPositionerElement.style.marginBottom,
      };
    },
  );

  createRenderEffect(
    () => ({
      open: open(),
      alignItemWithTriggerActive: alignItemWithTriggerActive(),
      positionerElement: positionerElement(),
    }),
    (current) => {
      if (current.open || current.alignItemWithTriggerActive) {
        return;
      }

      initialPlacedRef.current = false;
      reachedMaxHeightRef.current = false;
      clearStyles(current.positionerElement, originalPositionerStylesRef.current);
    },
  );

  createRenderEffect(
    () => ({
      open: open(),
      positionerElement: positionerElement(),
      triggerElement: triggerElement(),
      alignItemWithTriggerActive: alignItemWithTriggerActive(),
      listElement: listElement(),
      highlightItemOnHover: highlightItemOnHover(),
      direction: direction(),
      isPositioned: isPositioned(),
    }),
    (current) => {
      const popupElement = store.context.popupRef.current;
      const currentPositionerElement = current.positionerElement;
      const currentTriggerElement = current.triggerElement;

      // Wait for Floating UI's first positioning pass before reading DOM geometry.
      // We replace the final coordinates for aligned selects, but still need middleware
      // like `size()` to set CSS variables such as `--anchor-width`.
      if (
        !current.open ||
        !currentTriggerElement ||
        !currentPositionerElement ||
        !popupElement ||
        (current.alignItemWithTriggerActive && !current.isPositioned) ||
        store.state.transitionStatus === 'ending'
      ) {
        return;
      }

      initialPlacedRef.current = true;
      popupElement.style.removeProperty(SelectPositionerCssVars.transformOrigin);

      if (!current.alignItemWithTriggerActive) {
        // The wrapper supplies the scroller: the list owns scrolling once it has mounted, and
        // this effect re-runs (cancelling the stale frame) when that happens.
        scrollArrowFrame.request(() =>
          store.context.handleScrollArrowVisibility(current.listElement || popupElement),
        );
        return;
      }

      // Ensure we remove any transforms that can affect the location of the popup
      // and therefore the calculations.
      const restoreTransformStyles = unsetTransformStyles(popupElement);

      try {
        let textElement = store.context.selectedItemTextRef.current;

        if (!textElement?.isConnected) {
          const hasSelectedValue = store.select('hasSelectedValue');
          textElement =
            !hasSelectedValue && store.context.firstItemTextRef.current?.isConnected
              ? store.context.firstItemTextRef.current
              : null;
        }

        const valueElement = store.context.valueRef.current;

        const win = ownerWindow(currentPositionerElement);
        const positionerStyles = win.getComputedStyle(currentPositionerElement);
        const popupStyles = win.getComputedStyle(popupElement);

        const doc = ownerDocument(currentTriggerElement);
        const scale = getScale(currentTriggerElement);
        const triggerRect = normalizeRect(currentTriggerElement.getBoundingClientRect(), scale);

        const positionerRect = normalizeRect(
          currentPositionerElement.getBoundingClientRect(),
          scale,
        );
        const triggerHeight = triggerRect.height;
        const scroller = current.listElement || popupElement;
        const scrollHeight = scroller.scrollHeight;

        const borderBottom = parseFloat(popupStyles.borderBottomWidth);
        // The `|| N` fallbacks cover an unset/`auto` value (parses to `NaN`). Note a literal `0`
        // also resolves to the fallback, so an explicit `margin: 0` or `min-height: 0` still takes
        // the default below.
        const marginTop = parseFloat(positionerStyles.marginTop) || 10;
        const marginBottom = parseFloat(positionerStyles.marginBottom) || 10;
        const minHeight = parseFloat(positionerStyles.minHeight) || 100;
        const maxPopupHeight = getMaxPopupHeight(popupStyles);

        const paddingLeft = 5;
        const paddingRight = 5;
        const triggerCollisionThreshold = 20;

        const viewportHeight = doc.documentElement.clientHeight - marginTop - marginBottom;
        const viewportWidth = doc.documentElement.clientWidth;
        const availableSpaceBeneathTrigger = viewportHeight - triggerRect.bottom + triggerHeight;

        let textRect: ClientRectObject | undefined;
        let alignedLeft =
          current.direction === 'rtl'
            ? triggerRect.right - positionerRect.width
            : triggerRect.left;
        let offsetY = 0;

        if (textElement && valueElement) {
          const valueRect = normalizeRect(valueElement.getBoundingClientRect(), scale);
          textRect = normalizeRect(textElement.getBoundingClientRect(), scale);

          alignedLeft =
            positionerRect.left +
            (current.direction === 'rtl'
              ? valueRect.right - textRect.right
              : valueRect.left - textRect.left);
          const valueCenterFromTriggerTop = valueRect.top - triggerRect.top + valueRect.height / 2;
          const textCenterFromPositionerTop =
            textRect.top - positionerRect.top + textRect.height / 2;

          offsetY = textCenterFromPositionerTop - valueCenterFromTriggerTop;
        }

        const idealHeight = availableSpaceBeneathTrigger + offsetY + marginBottom + borderBottom;
        let height = Math.min(viewportHeight, idealHeight);
        const maxHeight = viewportHeight - marginTop - marginBottom;
        const scrollTop = idealHeight - height;

        const maxRight = viewportWidth - paddingRight;

        currentPositionerElement.style.left = `${clamp(
          alignedLeft,
          paddingLeft,
          maxRight - positionerRect.width,
        )}px`;
        currentPositionerElement.style.height = `${height}px`;
        // `none` (not the invalid `auto`) so the explicit height governs in align mode and isn't
        // clamped by a `max-height` from user CSS.
        currentPositionerElement.style.maxHeight = 'none';
        currentPositionerElement.style.marginTop = `${marginTop}px`;
        currentPositionerElement.style.marginBottom = `${marginBottom}px`;
        popupElement.style.height = '100%';

        const maxScrollTop = getMaxScrollTop(scroller);
        const isTopPositioned = scrollTop >= maxScrollTop - SCROLL_EDGE_TOLERANCE_PX;

        if (isTopPositioned) {
          height = Math.min(viewportHeight, positionerRect.height) - (scrollTop - maxScrollTop);
        }

        // When the trigger is too close to the top or bottom of the viewport, or the minHeight is
        // reached, we fallback to aligning the popup to the trigger as the UX is poor otherwise.
        const fallbackToAlignPopupToTrigger =
          triggerRect.top < triggerCollisionThreshold ||
          triggerRect.bottom > viewportHeight - triggerCollisionThreshold ||
          Math.ceil(height) + SCROLL_EDGE_TOLERANCE_PX < Math.min(scrollHeight, minHeight);

        // Safari doesn't position the popup correctly when pinch-zoomed.
        const isPinchZoomed = (win.visualViewport?.scale ?? 1) !== 1 && platform.engine.webkit;

        if (fallbackToAlignPopupToTrigger || isPinchZoomed) {
          clearStyles(currentPositionerElement, originalPositionerStylesRef.current);
          setControlledAlignItemWithTrigger(false);
          return;
        }

        const initialHeight = Math.max(minHeight, height);

        if (isTopPositioned) {
          const topOffset = Math.max(0, viewportHeight - idealHeight);
          currentPositionerElement.style.top =
            positionerRect.height >= maxHeight ? '0' : `${topOffset}px`;
          currentPositionerElement.style.height = `${height}px`;
          scroller.scrollTop = getMaxScrollTop(scroller);
        } else {
          currentPositionerElement.style.bottom = '0';
          scroller.scrollTop = scrollTop;
        }

        if (textRect) {
          const popupTop = positionerRect.top;
          const popupHeight = positionerRect.height;
          const textCenterY = textRect.top + textRect.height / 2;

          const clampedY = clamp(
            popupHeight > 0 ? ((textCenterY - popupTop) / popupHeight) * 100 : 50,
            0,
            100,
          );

          popupElement.style.setProperty(
            SelectPositionerCssVars.transformOrigin,
            `50% ${clampedY}%`,
          );
        }

        if (initialHeight === viewportHeight || height >= maxPopupHeight) {
          reachedMaxHeightRef.current = true;
        }

        store.context.handleScrollArrowVisibility(scroller);

        if (
          current.highlightItemOnHover &&
          store.state.selectedIndex === null &&
          store.state.activeIndex === null &&
          store.context.listRef.current[0] != null
        ) {
          store.set('activeIndex', 0);
        }
      } finally {
        restoreTransformStyles();
      }
    },
  );

  createEffect(
    () => ({
      alignItemWithTriggerActive: alignItemWithTriggerActive(),
      positionerElement: positionerElement(),
      open: open(),
    }),
    (current) => {
      if (!current.alignItemWithTriggerActive || !current.positionerElement || !current.open) {
        return undefined;
      }

      const win = ownerWindow(current.positionerElement);

      function handleResize(event: UIEvent) {
        store.context.setOpen(false, createChangeEventDetails(REASONS.windowResize, event));
      }

      return addEventListener(win, 'resize', handleResize);
    },
  );

  const defaultProps: HTMLProps = {
    get role() {
      return listElement() ? 'presentation' : 'listbox';
    },
    get 'aria-multiselectable'() {
      return !listElement() && multiple() ? 'true' : undefined;
    },
    get 'aria-readonly'() {
      return !listElement() && readOnly() ? 'true' : undefined;
    },
    get id() {
      return listElement() ? undefined : `${id()}-list`;
    },
    onKeyDown(event: KeyboardEvent) {
      if (insideToolbar && COMPOSITE_KEYS.has(event.key)) {
        event.stopPropagation();
      }
    },
    onScroll(event: Event) {
      if (untrack(listElement)) {
        return;
      }
      handleScroll(event.currentTarget as HTMLDivElement);
    },
    get style() {
      if (!alignItemWithTriggerActive()) {
        return undefined;
      }
      return listElement() ? ({ height: '100%' } as JSX.CSSProperties) : LIST_FUNCTIONAL_STYLES;
    },
    get class() {
      return !listElement() && alignItemWithTriggerActive()
        ? styleDisableScrollbar.className
        : undefined;
    },
  };

  const element = useRenderElement('div', componentProps, {
    ref: [store.context.popupRef],
    state,
    stateAttributesMapping,
    props: [
      (merged) => mergeProps(merged, popupProps()),
      defaultProps,
      {
        get style() {
          return getDisabledMountTransitionStyles(transitionStatus()).style;
        },
      },
      elementProps,
    ],
  });

  return (
    <>
      <Show when={!disableStyleElements}>{styleDisableScrollbar.getElement(nonce)}</Show>
      <IsolateChildren>
        <FloatingFocusManager
          context={floatingRootContext}
          modal={false}
          disabled={!mounted()}
          openInteractionType={openMethod()}
          returnFocus={componentProps.finalFocus}
          restoreFocus
        >
          {element}
        </FloatingFocusManager>
      </IsolateChildren>
    </>
  );
}

export interface SelectPopupProps extends BaseUIComponentProps<'div', SelectPopupState> {
  children?: JSX.Element;
  /**
   * Determines the element to focus when the select popup is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (trigger or previously focused element).
   * - `RefObject`: Move focus to the ref element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  finalFocus?:
    | boolean
    | RefObject<HTMLElement>
    | ((closeType: InteractionType) => boolean | HTMLElement | null | void)
    | undefined;
}

export interface SelectPopupState {
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side | 'none';
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the component is open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export namespace SelectPopup {
  export type Props = SelectPopupProps;
  export type State = SelectPopupState;
}

function getMaxPopupHeight(popupStyles: CSSStyleDeclaration) {
  const maxHeightStyle = popupStyles.maxHeight;
  return maxHeightStyle.endsWith('px') ? parseFloat(maxHeightStyle) || Infinity : Infinity;
}

function getMaxScrollTop(scroller: HTMLElement) {
  return getMaxScrollOffset(scroller.scrollHeight, scroller.clientHeight);
}

function getScale(element: HTMLElement) {
  // The platform API is async-capable, but the DOM platform returns a plain scale object.
  return floatingPlatform.getScale(element) as { x: number; y: number };
}

function normalizeSize(size: number, axis: 'x' | 'y', scale: { x: number; y: number }) {
  return size / scale[axis];
}

function normalizeRect(
  rect: DOMRect | DOMRectReadOnly,
  scale: { x: number; y: number },
): ClientRectObject {
  return rectToClientRect({
    x: normalizeSize(rect.x, 'x', scale),
    y: normalizeSize(rect.y, 'y', scale),
    width: normalizeSize(rect.width, 'x', scale),
    height: normalizeSize(rect.height, 'y', scale),
  });
}

const TRANSFORM_STYLE_RESETS = [
  ['transform', 'none'],
  ['scale', '1'],
  ['translate', '0 0'],
] as const;

type TransformStyleProperty = (typeof TRANSFORM_STYLE_RESETS)[number][0];

function unsetTransformStyles(popupElement: HTMLElement) {
  const { style } = popupElement;
  const originalStyles = {} as Record<TransformStyleProperty, string>;

  for (const [property, value] of TRANSFORM_STYLE_RESETS) {
    originalStyles[property] = style.getPropertyValue(property);
    style.setProperty(property, value, 'important');
  }

  return () => {
    for (const [property] of TRANSFORM_STYLE_RESETS) {
      const originalValue = originalStyles[property];
      if (originalValue) {
        style.setProperty(property, originalValue);
      } else {
        style.removeProperty(property);
      }
    }
  };
}
