import {
  createEffect,
  createMemo,
  createRenderEffect,
  createSignal,
  untrack,
  type Accessor,
} from 'solid-js';
import type { JSX } from '@solidjs/web';
import { getSide, getAlignment, type Rect, getSideAxis } from '@floating-ui/utils';
import { ownerDocument, ownerWindow } from '@base-ui/utils/owner';
import {
  autoUpdate,
  flip,
  limitShift,
  offset,
  shift as floatingShift,
  size,
  type UseFloatingOptions,
  type UseFloatingReturn,
  type Placement,
  type FloatingRootContext,
  type VirtualElement,
  type Padding,
  type FloatingContext,
  type Side as PhysicalSide,
  type MiddlewareState,
  type AutoUpdateOptions,
  type Middleware,
  type FloatingTreeStore,
} from '../floating-ui-react';
import { useBaseUIFloating } from '../floating-ui-react/hooks/useFloating';
import { useDirection } from './direction-context/DirectionContext';
import { arrow } from '../floating-ui-react/middleware/arrow';
import { hide } from '../utils/hideMiddleware';
import { DEFAULT_SIDES } from '../utils/adaptiveOriginConstants';
import * as CommonPositionerCssVars from '../utils/CommonPositionerCssVars';
import { createRef, type RefObject } from '../solid-utils/refs';

const AVAILABLE_WIDTH_VAR = CommonPositionerCssVars.availableWidth;
const AVAILABLE_HEIGHT_VAR = CommonPositionerCssVars.availableHeight;

function getLogicalSide(sideParam: Side, renderedSide: PhysicalSide, isRtl: boolean): Side {
  const isLogicalSideParam = sideParam === 'inline-start' || sideParam === 'inline-end';
  const logicalRight = isRtl ? 'inline-start' : 'inline-end';
  const logicalLeft = isRtl ? 'inline-end' : 'inline-start';
  return (
    {
      top: 'top',
      right: isLogicalSideParam ? logicalRight : 'right',
      bottom: 'bottom',
      left: isLogicalSideParam ? logicalLeft : 'left',
    } satisfies Record<PhysicalSide, Side>
  )[renderedSide];
}

function getOffsetData(state: MiddlewareState, sideParam: Side, isRtl: boolean) {
  const { rects, placement } = state;
  const data = {
    side: getLogicalSide(sideParam, getSide(placement), isRtl),
    align: getAlignment(placement) || 'center',
    anchor: { width: rects.reference.width, height: rects.reference.height },
    positioner: { width: rects.floating.width, height: rects.floating.height },
  } as const;
  return data;
}

export type Side = 'top' | 'bottom' | 'left' | 'right' | 'inline-end' | 'inline-start';
export type Align = 'start' | 'center' | 'end';
export type Boundary = 'clipping-ancestors' | Element | Element[] | Rect;
export type OffsetFunction = (data: {
  side: Side;
  align: Align;
  anchor: { width: number; height: number };
  positioner: { width: number; height: number };
}) => number;

interface SideFlipMode {
  /**
   * How to avoid collisions on the side axis.
   * - `'flip'`: If there is not enough space, place the popup on the opposite side.
   * - `'none'`: Keep the preferred side even if it overflows.
   */
  side?: 'flip' | 'none' | undefined;
  /**
   * How to avoid collisions on the align axis.
   * - `'flip'`: If there is not enough space, swap `'start'` and `'end'` alignment.
   * - `'shift'`: Keep the alignment and shift the popup to fit within the boundary.
   * - `'none'`: Keep the preferred alignment even if it overflows.
   */
  align?: 'flip' | 'shift' | 'none' | undefined;
  /**
   * If both sides on the preferred axis do not fit, determines whether to fallback
   * to a side on the perpendicular axis and which logical side to prefer.
   * - `'start'`: Prefer the logical start side on the perpendicular axis.
   * - `'end'`: Prefer the logical end side on the perpendicular axis.
   * - `'none'`: Do not fallback to the perpendicular axis.
   */
  fallbackAxisSide?: 'start' | 'end' | 'none' | undefined;
}

interface SideShiftMode {
  /**
   * How to avoid collisions on the side axis.
   * - `'shift'`: Keep the preferred side and shift the popup to fit within the boundary.
   * - `'none'`: Keep the preferred side even if it overflows.
   */
  side?: 'shift' | 'none' | undefined;
  /**
   * How to avoid collisions on the align axis.
   * - `'shift'`: Keep the alignment and shift the popup to fit within the boundary.
   * - `'none'`: Keep the preferred alignment even if it overflows.
   */
  align?: 'shift' | 'none' | undefined;
  /**
   * If both sides on the preferred axis do not fit, determines whether to fallback
   * to a side on the perpendicular axis and which logical side to prefer.
   * - `'start'`: Prefer the logical start side on the perpendicular axis.
   * - `'end'`: Prefer the logical end side on the perpendicular axis.
   * - `'none'`: Do not fallback to the perpendicular axis.
   */
  fallbackAxisSide?: 'start' | 'end' | 'none' | undefined;
}

export type CollisionAvoidance = SideFlipMode | SideShiftMode;

type UseFloatingHook = (options: UseFloatingOptions) => UseFloatingReturn;

/**
 * Attaches value-level dependencies to a middleware so the position engine's
 * deep-equal middleware memo invalidates when they change. The Solid stand-in
 * for `@floating-ui/react-dom`'s middleware dependency arrays: closures compare
 * equal by source text, so value dependencies must be carried in `options`.
 */
function withDeps(middleware: Middleware, deps: unknown[]): Middleware {
  return { ...middleware, options: deps };
}

/**
 * Provides standardized anchor positioning behavior for floating elements. Wraps Floating UI's
 * `useFloating` hook.
 *
 * Solid port notes: `params` should be a reactive object (use getters for reactive values);
 * reactive return values are accessors. `floatingRootContext` and `externalTree` are read once.
 */
export function useAnchorPositioning(
  params: UseAnchorPositioningParameters & { floatingRootContext: FloatingRootContext },
): UseAnchorPositioningReturnValue {
  return useAnchorPositioningWithHook(params, useBaseUIFloating as UseFloatingHook);
}

export function useAnchorPositioningWithHook(
  params: UseAnchorPositioningParameters,
  useFloatingHook: UseFloatingHook,
): UseAnchorPositioningReturnValue {
  // Public parameters
  const positionMethod = () => params.positionMethod ?? 'absolute';
  const sideParam = () => params.side ?? 'bottom';
  const align = () => params.align ?? 'center';
  const sticky = () => params.sticky ?? false;
  const arrowPadding = () => params.arrowPadding ?? 5;
  const disableAnchorTracking = () => params.disableAnchorTracking ?? false;
  // Private parameters
  const keepMounted = () => params.keepMounted ?? false;
  const floatingRootContext = untrack(() => params.floatingRootContext);
  const mounted = () => params.mounted;
  const lazyFlip = () => params.lazyFlip ?? false;
  const externalTree = untrack(() => params.externalTree);

  const [mountSide, setMountSide] = createSignal<PhysicalSide | null>(null, { ownedWrite: true });

  createRenderEffect(
    () => mounted(),
    (isMounted) => {
      if (!isMounted && untrack(mountSide) !== null) {
        setMountSide(null);
      }
    },
  );

  const collisionAvoidanceSide = () => params.collisionAvoidance.side || 'flip';
  const collisionAvoidanceAlign = () => params.collisionAvoidance.align || 'flip';
  const collisionAvoidanceFallbackAxisSide = () => params.collisionAvoidance.fallbackAxisSide || 'end';
  const shiftCrossAxis = () => params.shift?.crossAxis ?? false;
  const shiftRootBoundary = () => params.shift?.rootBoundary;

  const direction = useDirection();
  const isRtl = () => direction() === 'rtl';

  const side = (): PhysicalSide =>
    mountSide() ||
    (
      {
        top: 'top',
        right: 'right',
        bottom: 'bottom',
        left: 'left',
        'inline-end': isRtl() ? 'left' : 'right',
        'inline-start': isRtl() ? 'right' : 'left',
      } satisfies Record<Side, PhysicalSide>
    )[sideParam()];

  const placement = () => (align() === 'center' ? side() : (`${side()}-${align()}` as Placement));

  const collisionPadding = (): { top: number; right: number; bottom: number; left: number } => {
    const collisionPaddingParam = params.collisionPadding ?? 5;
    if (typeof collisionPaddingParam === 'number') {
      return {
        top: collisionPaddingParam,
        right: collisionPaddingParam,
        bottom: collisionPaddingParam,
        left: collisionPaddingParam,
      };
    }
    return {
      top: collisionPaddingParam.top || 0,
      right: collisionPaddingParam.right || 0,
      bottom: collisionPaddingParam.bottom || 0,
      left: collisionPaddingParam.left || 0,
    };
  };

  const commonCollisionProps = () =>
    ({
      boundary:
        params.collisionBoundary === 'clipping-ancestors'
          ? ('clippingAncestors' as const)
          : params.collisionBoundary,
      padding: collisionPadding(),
    }) as const;

  // Using a ref assumes that the arrow element is always present in the DOM for the lifetime of the
  // popup. If this assumption ends up being false, we can switch to state to manage the arrow's
  // presence.
  const arrowRef = createRef<Element>();

  const shiftDisabled = () => collisionAvoidanceAlign() === 'none' && collisionAvoidanceSide() !== 'shift';
  const crossAxisShiftEnabled = () =>
    !shiftDisabled() && (sticky() || shiftCrossAxis() || collisionAvoidanceSide() === 'shift');

  const readSideOffset = () => params.sideOffset ?? 0;
  const readAlignOffset = () => params.alignOffset ?? 0;

  // The middleware getter is read inside the position engine's tracked
  // middleware memo, so every reactive read here invalidates it. Closures read
  // the current values lazily (they run outside reactive scopes during
  // `computePosition`); value-level dependencies are attached via `withDeps` so
  // the deep-equal memo can tell rebuilt arrays apart (see the React version's
  // middleware dependency arrays).
  const middleware = (): UseFloatingOptions['middleware'] => {
    const middlewareList: NonNullable<UseFloatingOptions['middleware']> = [];

    const inlineMiddleware = params.inline;
    if (inlineMiddleware) {
      middlewareList.push(inlineMiddleware);
    }

    const sideParamValue = sideParam();
    const isRtlValue = isRtl();
    const collisionAvoidanceSideValue = collisionAvoidanceSide();
    const collisionAvoidanceAlignValue = collisionAvoidanceAlign();
    const collisionPaddingValue = collisionPadding();
    const commonCollisionPropsValue = commonCollisionProps();
    const stickyValue = sticky();
    const shiftCrossAxisValue = shiftCrossAxis();
    const sideOffsetDep = typeof untrack(readSideOffset) !== 'function' ? readSideOffset() : 0;
    const alignOffsetDep = typeof untrack(readAlignOffset) !== 'function' ? readAlignOffset() : 0;

    // Create a bias to the preferred side.
    // On iOS, when the mobile software keyboard opens, the input is exactly centered
    // in the viewport, but this can cause it to flip to the top undesirably.
    // The bias is only applied to `flip()` so it doesn't shift the resting position
    // computed by `shift()` and `size()` away from the requested `collisionPadding`.
    const bias = 1;
    const biasTop = sideParamValue === 'bottom' ? bias : 0;
    const biasBottom = sideParamValue === 'top' ? bias : 0;
    const biasLeft = sideParamValue === 'right' ? bias : 0;
    const biasRight = sideParamValue === 'left' ? bias : 0;

    middlewareList.push(
      withDeps(
        offset((state) => {
          const data = getOffsetData(state, untrack(sideParam), untrack(isRtl));

          const sideOffsetValue = untrack(readSideOffset);
          const alignOffsetValue = untrack(readAlignOffset);

          const sideAxis =
            typeof sideOffsetValue === 'function' ? sideOffsetValue(data) : sideOffsetValue;
          const alignAxis =
            typeof alignOffsetValue === 'function' ? alignOffsetValue(data) : alignOffsetValue;

          return {
            mainAxis: sideAxis,
            crossAxis: alignAxis,
            alignmentAxis: alignAxis,
          };
        }),
        [sideOffsetDep, alignOffsetDep, isRtlValue, sideParamValue],
      ),
    );

    const flipMiddleware =
      collisionAvoidanceSideValue === 'none'
        ? null
        : flip({
            ...commonCollisionPropsValue,
            // Ensure the popup flips if it's been limited by its --available-height and it resizes.
            // Since the size() padding is smaller than the flip() padding, flip() will take precedence.
            padding: {
              top: collisionPaddingValue.top + bias + biasTop,
              right: collisionPaddingValue.right + bias + biasRight,
              bottom: collisionPaddingValue.bottom + bias + biasBottom,
              left: collisionPaddingValue.left + bias + biasLeft,
            },
            mainAxis: !shiftCrossAxisValue && collisionAvoidanceSideValue === 'flip',
            crossAxis: collisionAvoidanceAlignValue === 'flip' ? 'alignment' : false,
            fallbackAxisSideDirection: collisionAvoidanceFallbackAxisSide(),
          });
    const shiftMiddleware = shiftDisabled()
      ? null
      : withDeps(
          floatingShift({
            ...commonCollisionPropsValue,
            // Use the Layout Viewport to avoid shifting around when pinch-zooming.
            rootBoundary: shiftRootBoundary(),
            mainAxis: collisionAvoidanceAlignValue !== 'none',
            crossAxis: crossAxisShiftEnabled(),
            limiter:
              stickyValue || shiftCrossAxisValue
                ? undefined
                : limitShift((limitData) => {
                    if (!arrowRef.current) {
                      return {};
                    }
                    const { width, height } = arrowRef.current.getBoundingClientRect();
                    const sideAxis = getSideAxis(getSide(limitData.placement));
                    const arrowSize = sideAxis === 'y' ? width : height;
                    const currentCollisionPadding = untrack(collisionPadding);
                    const offsetAmount =
                      sideAxis === 'y'
                        ? currentCollisionPadding.left + currentCollisionPadding.right
                        : currentCollisionPadding.top + currentCollisionPadding.bottom;
                    return {
                      offset: arrowSize / 2 + offsetAmount / 2,
                    };
                  }),
          }),
          [
            commonCollisionPropsValue,
            stickyValue,
            shiftCrossAxisValue,
            shiftRootBoundary(),
            collisionPaddingValue,
            collisionAvoidanceAlignValue,
          ],
        );

    // https://floating-ui.com/docs/flip#combining-with-shift
    if (
      collisionAvoidanceSideValue === 'shift' ||
      collisionAvoidanceAlignValue === 'shift' ||
      align() === 'center'
    ) {
      middlewareList.push(shiftMiddleware, flipMiddleware);
    } else {
      middlewareList.push(flipMiddleware, shiftMiddleware);
    }

    middlewareList.push(
      size({
        ...commonCollisionPropsValue,
        apply({ elements: { floating }, availableWidth, availableHeight, rects }) {
          if (!untrack(mounted)) {
            return;
          }

          const floatingStyle = floating.style;
          floatingStyle.setProperty(AVAILABLE_WIDTH_VAR, `${availableWidth}px`);
          floatingStyle.setProperty(AVAILABLE_HEIGHT_VAR, `${availableHeight}px`);

          // Snap anchor dimensions to device pixels to ensure the popup's visual width matches the anchor's one.
          const dpr = ownerWindow(floating).devicePixelRatio || 1;
          const { x, y, width, height } = rects.reference;
          const anchorWidth = (Math.round((x + width) * dpr) - Math.round(x * dpr)) / dpr;
          const anchorHeight = (Math.round((y + height) * dpr) - Math.round(y * dpr)) / dpr;

          floatingStyle.setProperty(CommonPositionerCssVars.anchorWidth, `${anchorWidth}px`);
          floatingStyle.setProperty(CommonPositionerCssVars.anchorHeight, `${anchorHeight}px`);
        },
      }),
      withDeps(
        arrow((state) => ({
          // `transform-origin` calculations rely on an element existing. If the arrow hasn't been set,
          // we'll create a fake element.
          element: arrowRef.current || ownerDocument(state.elements.floating).createElement('div'),
          // No padding for the fake arrow: it would displace aligned popups on narrow anchors.
          padding: arrowRef.current ? untrack(arrowPadding) : 0,
          offsetParent: 'floating',
        })),
        [arrowPadding()],
      ),
      {
        name: 'transformOrigin',
        fn(state) {
          const {
            elements: { floating },
            middlewareData,
            placement: renderedPlacement,
            platform,
            rects,
            y,
          } = state;

          const renderedSide = getSide(renderedPlacement);
          const renderedAlign = getAlignment(renderedPlacement);
          const isVertical = getSideAxis(renderedSide) === 'y';
          const arrowEl = arrowRef.current;

          const sideOffsetOption = untrack(readSideOffset);
          const sideOffsetValue =
            typeof sideOffsetOption === 'function'
              ? sideOffsetOption(getOffsetData(state, untrack(sideParam), untrack(isRtl)))
              : sideOffsetOption;

          // An aligned arrowless popup grows from its aligned edge, until a shift (beyond subpixel)
          // breaks its alignment with the anchor. Everything else grows from the arrow, real or fake.
          let crossOrigin: string;
          if (
            !arrowEl &&
            renderedAlign &&
            Math.abs(isVertical ? middlewareData.shift?.x || 0 : middlewareData.shift?.y || 0) <= 1
          ) {
            // The platform direction, not `isRtl`: it must match what Floating UI placed with.
            crossOrigin =
              (renderedAlign === 'start') === (isVertical && platform.isRTL?.(floating) === true)
                ? '100%'
                : '0%';
          } else {
            const arrowOffset = isVertical
              ? middlewareData.arrow?.x || 0
              : middlewareData.arrow?.y || 0;
            const arrowSize = isVertical ? arrowEl?.clientWidth || 0 : arrowEl?.clientHeight || 0;
            crossOrigin = `${arrowOffset + arrowSize / 2}px`;
          }

          // Side axis: the anchor-facing edge, or the anchor's center when the popup overlaps it.
          let sideOrigin =
            renderedSide === 'top' || renderedSide === 'left'
              ? `calc(100% + ${sideOffsetValue}px)`
              : `${-sideOffsetValue}px`;
          if (
            untrack(crossAxisShiftEnabled) &&
            isVertical &&
            Math.abs(middlewareData.shift?.y || 0) > sideOffsetValue
          ) {
            sideOrigin = `${rects.reference.y + rects.reference.height / 2 - y}px`;
          }

          floating.style.setProperty(
            CommonPositionerCssVars.transformOrigin,
            isVertical ? `${crossOrigin} ${sideOrigin}` : `${sideOrigin} ${crossOrigin}`,
          );

          return {};
        },
      },
      hide,
      params.adaptiveOrigin,
    );

    return middlewareList;
  };

  createRenderEffect(
    () => mounted(),
    (isMounted) => {
      // Ensure positioning doesn't run initially for `keepMounted` elements that
      // aren't initially open.
      if (!isMounted && floatingRootContext) {
        floatingRootContext.update({
          referenceElement: null,
          floatingElement: null,
          domReferenceElement: null,
          positionReference: null,
        });
      }
    },
  );

  const autoUpdateOptions = createMemo<AutoUpdateOptions>(() => ({
    ancestorScroll: !disableAnchorTracking(),
    elementResize: !disableAnchorTracking() && typeof ResizeObserver !== 'undefined',
    layoutShift: !disableAnchorTracking() && typeof IntersectionObserver !== 'undefined',
  }));

  // Stable identity: `@floating-ui/react-dom` keeps `whileElementsMounted` in a
  // ref, so identity changes never re-attach `autoUpdate`. The options are read
  // lazily for the same reason.
  const whileElementsMountedFn = (
    ...args: [Element | VirtualElement, HTMLElement, () => void]
  ): (() => void) => autoUpdate(...args, untrack(autoUpdateOptions));

  const returnedFloating = useFloatingHook({
    rootContext: floatingRootContext,
    get open() {
      return keepMounted() ? mounted() : undefined;
    },
    get placement() {
      return placement();
    },
    get middleware() {
      return middleware();
    },
    get strategy() {
      return positionMethod();
    },
    get whileElementsMounted() {
      return keepMounted() ? undefined : whileElementsMountedFn;
    },
    get nodeId() {
      return params.nodeId;
    },
    externalTree,
  });

  const { refs, elements, update, context } = returnedFloating;
  const isPositioned = returnedFloating.isPositioned;
  const middlewareData = returnedFloating.middlewareData;

  const adaptiveOriginSides = () => middlewareData().adaptiveOrigin || DEFAULT_SIDES;

  // Default to `fixed` when not positioned to prevent `autoFocus` scroll jumps.
  // This ensures the popup is inside the viewport initially before it gets positioned.
  const resolvedPosition = (): 'absolute' | 'fixed' =>
    isPositioned() ? positionMethod() : 'fixed';

  const floatingStyles = createMemo<JSX.CSSProperties>(() => {
    let base: JSX.CSSProperties & Record<string, string | number | undefined>;
    if (!isPositioned()) {
      // Until a position for the current open is computed, ignore any coordinates retained from a
      // previous open (or from a pass that measured the hidden popup as 0x0). Rendering the
      // full-size popup at such stale coordinates can overflow the layout viewport, which makes
      // mobile Chrome zoom the page out and reflow everything the popup is anchored to.
      base = { position: resolvedPosition(), top: '0', left: '0' };
    } else if (params.adaptiveOrigin) {
      const { sideX, sideY } = adaptiveOriginSides();
      base = {
        position: resolvedPosition(),
        [sideX]: `${returnedFloating.x()}px`,
        [sideY]: `${returnedFloating.y()}px`,
      };
    } else {
      base = { ...returnedFloating.floatingStyles(), position: resolvedPosition() };
    }

    // Seed the available size vars so consumer `max-height: min(x, var(--available-height))` rules
    // resolve to a valid length on the first positioning pass, before `size()` writes the real
    // values. Without a fallback the unresolved `var()` invalidates the whole declaration, so the
    // popup is measured unconstrained while `flip()` picks its side, against the full content
    // height rather than the capped one. Seeded unconditionally (not only while `!isPositioned`):
    // the keys must stay present with a constant value so the per-property style diff never
    // rewrites them after mount, preserving the px values `size()` sets imperatively. Moving them
    // into the `!isPositioned` branch would remove them once positioned, wiping `size()`'s values
    // and leaving the popup unconstrained.
    base[AVAILABLE_WIDTH_VAR] = '100vw';
    base[AVAILABLE_HEIGHT_VAR] = '100vh';

    if (!isPositioned()) {
      base.opacity = 0;
    }
    return base;
  });

  const registeredPositionReferenceRef = createRef<Element | VirtualElement>();

  // Tracks the anchor unless it is a function (functions are read lazily,
  // mirroring the React version's stable-callback dependency).
  const anchorDep = () => {
    const anchorValue = params.anchor;
    return typeof anchorValue === 'function' ? 'function' : anchorValue;
  };

  createRenderEffect(
    () => ({ mounted: mounted(), anchor: anchorDep() }),
    (current) => {
      if (!current.mounted) {
        return;
      }

      const anchorValue = untrack(() => params.anchor);
      const resolvedAnchor = typeof anchorValue === 'function' ? anchorValue() : anchorValue;
      const unwrappedElement =
        (isRef(resolvedAnchor) ? resolvedAnchor.current : resolvedAnchor) || null;
      const finalAnchor = unwrappedElement || null;

      if (finalAnchor !== registeredPositionReferenceRef.current) {
        refs.setPositionReference(finalAnchor);
        registeredPositionReferenceRef.current = finalAnchor;
      }
    },
  );

  createEffect(
    () => ({ mounted: mounted(), anchor: anchorDep() }),
    (current) => {
      if (!current.mounted) {
        return;
      }

      const anchorValue = untrack(() => params.anchor);

      // Refs from parent components are set after render effects run and are available in regular
      // effects. Therefore, if the anchor is a ref, we need to update the position reference here.
      if (typeof anchorValue === 'function') {
        return;
      }

      if (isRef(anchorValue) && anchorValue.current !== registeredPositionReferenceRef.current) {
        refs.setPositionReference(anchorValue.current);
        registeredPositionReferenceRef.current = anchorValue.current;
      }
    },
  );

  createEffect(
    () => ({
      keepMounted: keepMounted(),
      mounted: mounted(),
      reference: elements.reference(),
      floating: elements.floating(),
      options: autoUpdateOptions(),
    }),
    (current) => {
      if (current.keepMounted && current.mounted && current.reference && current.floating) {
        return autoUpdate(current.reference, current.floating, update, current.options);
      }
      return undefined;
    },
  );

  const renderedSide = () => getSide(returnedFloating.placement());
  const logicalRenderedSide = () => getLogicalSide(sideParam(), renderedSide(), isRtl());
  const renderedAlign = (): Align => getAlignment(returnedFloating.placement()) || 'center';
  const anchorHidden = () => Boolean(middlewareData().hide?.referenceHidden);

  // Locks the flip (makes it "sticky") so it doesn't prefer a given placement
  // and flips back lazily, not eagerly. Ideal for filtered lists that change
  // the size of the popup dynamically to avoid unwanted flipping when typing.
  createRenderEffect(
    () => ({
      lazyFlip: lazyFlip(),
      mounted: mounted(),
      isPositioned: isPositioned(),
      renderedSide: renderedSide(),
      side: side(),
    }),
    (current) => {
      if (
        current.lazyFlip &&
        current.mounted &&
        current.isPositioned &&
        current.renderedSide !== current.side
      ) {
        setMountSide(current.renderedSide);
      }
    },
  );

  const arrowStyles = createMemo<JSX.CSSProperties>(() => {
    const arrowData = middlewareData().arrow;
    return {
      position: 'absolute' as const,
      top: arrowData?.y != null ? `${arrowData.y}px` : undefined,
      left: arrowData?.x != null ? `${arrowData.x}px` : undefined,
    };
  });

  const arrowUncentered = () => middlewareData().arrow?.centerOffset !== 0;

  return {
    positionerStyles: floatingStyles,
    arrowStyles,
    arrowRef,
    arrowUncentered,
    side: logicalRenderedSide,
    align: renderedAlign,
    physicalSide: renderedSide,
    anchorHidden,
    refs,
    context,
    isPositioned,
    update,
  };
}

function isRef(
  param: Element | VirtualElement | RefObject<any> | null | undefined,
): param is RefObject<any> {
  return param != null && 'current' in param;
}

export interface UseAnchorPositioningSharedParameters {
  /**
   * An element to position the popup against.
   * By default, the popup will be positioned against the trigger.
   */
  anchor?:
    | Element
    | null
    | VirtualElement
    | RefObject<Element | null>
    | (() => Element | VirtualElement | null)
    | undefined;
  /**
   * Determines which CSS `position` property to use.
   * @default 'absolute'
   */
  positionMethod?: 'absolute' | 'fixed' | undefined;
  /**
   * Which side of the anchor element to align the popup against.
   * May automatically change to avoid collisions.
   * @default 'bottom'
   */
  side?: Side | undefined;
  /**
   * Distance between the anchor and the popup in pixels.
   * Also accepts a function that returns the distance to read the dimensions of the anchor
   * and positioner elements, along with its side and alignment.
   *
   * The function takes a `data` object parameter with the following properties:
   * - `data.anchor`: the dimensions of the anchor element with properties `width` and `height`.
   * - `data.positioner`: the dimensions of the positioner element with properties `width` and `height`.
   * - `data.side`: which side of the anchor element the positioner is aligned against.
   * - `data.align`: how the positioner is aligned relative to the specified side.
   *
   * @example
   * ```jsx
   * <Positioner
   *   sideOffset={({ side, align, anchor, positioner }) => {
   *     return side === 'top' || side === 'bottom'
   *       ? anchor.height
   *       : anchor.width;
   *   }}
   * />
   * ```
   *
   * @default 0
   */
  sideOffset?: number | OffsetFunction | undefined;
  /**
   * How to align the popup relative to the specified side.
   * @default 'center'
   */
  align?: Align | undefined;
  /**
   * Additional offset along the alignment axis in pixels.
   * Also accepts a function that returns the offset to read the dimensions of the anchor
   * and positioner elements, along with its side and alignment.
   *
   * The function takes a `data` object parameter with the following properties:
   * - `data.anchor`: the dimensions of the anchor element with properties `width` and `height`.
   * - `data.positioner`: the dimensions of the positioner element with properties `width` and `height`.
   * - `data.side`: which side of the anchor element the positioner is aligned against.
   * - `data.align`: how the positioner is aligned relative to the specified side.
   *
   * @example
   * ```jsx
   * <Positioner
   *   alignOffset={({ side, align, anchor, positioner }) => {
   *     return side === 'top' || side === 'bottom'
   *       ? anchor.width
   *       : anchor.height;
   *   }}
   * />
   * ```
   *
   * @default 0
   */
  alignOffset?: number | OffsetFunction | undefined;
  /**
   * An element or a rectangle that delimits the area that the popup is confined to.
   * @default 'clipping-ancestors'
   */
  collisionBoundary?: Boundary | undefined;
  /**
   * Additional space to maintain from the edge of the collision boundary.
   * @default 5
   */
  collisionPadding?: Padding | undefined;
  /**
   * Whether to maintain the popup in the viewport after
   * the anchor element was scrolled out of view.
   * @default false
   */
  sticky?: boolean | undefined;
  /**
   * Minimum distance to maintain between the arrow and the edges of the popup.
   *
   * Use it to prevent the arrow element from hanging out of the rounded corners of a popup.
   * @default 5
   */
  arrowPadding?: number | undefined;
  /**
   * Whether to disable the popup from tracking any layout shift of its positioning anchor.
   * @default false
   */
  disableAnchorTracking?: boolean | undefined;
  /**
   * Determines how to handle collisions when positioning the popup.
   *
   * `side` controls overflow on the preferred placement axis (`top`/`bottom` or `left`/`right`):
   * - `'flip'`: keep the requested side when it fits; otherwise try the opposite side
   *   (`top` and `bottom`, or `left` and `right`).
   * - `'shift'`: never change side; keep the requested side and move the popup within
   *   the clipping boundary so it stays visible.
   * - `'none'`: do not correct side-axis overflow.
   *
   * `align` controls overflow on the alignment axis (`start`/`center`/`end`):
   * - `'flip'`: keep side, but swap `start` and `end` when the requested alignment overflows.
   * - `'shift'`: keep side and requested alignment, then nudge the popup along the
   *   alignment axis to fit.
   * - `'none'`: do not correct alignment-axis overflow.
   *
   * `fallbackAxisSide` controls fallback behavior on the perpendicular axis when the
   * preferred axis cannot fit:
   * - `'start'`: allow perpendicular fallback and try the logical start side first
   *   (`top` before `bottom`, or `left` before `right` in LTR).
   * - `'end'`: allow perpendicular fallback and try the logical end side first
   *   (`bottom` before `top`, or `right` before `left` in LTR).
   * - `'none'`: do not fallback to the perpendicular axis.
   *
   * When `side` is `'shift'`, explicitly setting `align` only supports `'shift'` or `'none'`.
   * If `align` is omitted, it defaults to `'flip'`.
   *
   * @example
   * ```jsx
   * <Positioner
   *   collisionAvoidance={{
   *     side: 'shift',
   *     align: 'shift',
   *     fallbackAxisSide: 'none',
   *   }}
   * />
   * ```
   *
   */
  collisionAvoidance?: CollisionAvoidance | undefined;
}

export interface UseAnchorPositioningParameters extends UseAnchorPositioningSharedParameters {
  keepMounted?: boolean | undefined;
  floatingRootContext?: FloatingRootContext | undefined;
  mounted: boolean;
  disableAnchorTracking: boolean;
  nodeId?: string | undefined;
  adaptiveOrigin?: Middleware | undefined;
  collisionAvoidance: CollisionAvoidance;
  shift?:
    | {
        crossAxis?: boolean | undefined;
        rootBoundary?: 'layoutViewport' | undefined;
      }
    | undefined;
  lazyFlip?: boolean | undefined;
  externalTree?: FloatingTreeStore | undefined;
  /**
   * Optional middleware that can replace the measured reference rect before offsets and collision
   * middleware run. Used by Preview Card to position against a specific inline line box.
   */
  inline?: Middleware | undefined;
}

export interface UseAnchorPositioningReturnValue {
  positionerStyles: Accessor<JSX.CSSProperties>;
  arrowStyles: Accessor<JSX.CSSProperties>;
  arrowRef: RefObject<Element>;
  arrowUncentered: Accessor<boolean>;
  side: Accessor<Side>;
  align: Accessor<Align>;
  physicalSide: Accessor<PhysicalSide>;
  anchorHidden: Accessor<boolean>;
  refs: UseFloatingReturn['refs'];
  context: FloatingContext;
  isPositioned: Accessor<boolean>;
  update: () => void;
}
