import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type {
  Middleware,
  MiddlewareData,
  Placement,
  Platform,
  Strategy,
  VirtualElement,
} from '@floating-ui/dom';
import type { BaseUIChangeEventDetails } from '../internals/createBaseUIEventDetails';
import type { HTMLProps } from '../internals/types';
import type { RefObject } from '../solid-utils/refs';

import type { FloatingTreeStore } from './components/FloatingTreeStore';
import type { FloatingRootStore } from './components/FloatingRootStore';

export * from '.';
export type { UseFloatingPortalNodeProps } from './components/FloatingPortal';
// Not ported yet (interaction layer):
export type { FloatingDelayGroupProps } from './components/FloatingDelayGroup';
export type { FloatingFocusManagerProps } from './components/FloatingFocusManager';
export type { UseClientPointProps } from './hooks/useClientPoint';
export type { UseDismissProps } from './hooks/useDismiss';
export type { UseFocusProps } from './hooks/useFocus';
export type { UseHoverProps } from './hooks/useHover';
export type { HandleCloseContext, HandleClose } from './hooks/useHoverShared';
export type { UseHoverFloatingInteractionProps } from './hooks/useHoverFloatingInteraction';
export type { UseHoverReferenceInteractionProps } from './hooks/useHoverReferenceInteraction';
export type { UseListNavigationProps } from './hooks/useListNavigation';
export type { UseTypeaheadProps } from './hooks/useTypeahead';
export type { UseFloatingRootContextOptions } from './hooks/useFloatingRootContext';
export type { SafePolygonOptions } from './safePolygon';
export type { FloatingTreeProps, FloatingNodeProps } from './components/FloatingTree';
export type {
  AlignedPlacement,
  Alignment,
  ArrowOptions,
  AutoPlacementOptions,
  AutoUpdateOptions,
  Axis,
  Boundary,
  ClientRectObject,
  ComputePositionConfig,
  ComputePositionReturn,
  Coords,
  DetectOverflowOptions,
  Dimensions,
  ElementContext,
  ElementRects,
  Elements,
  FlipOptions,
  FloatingElement,
  HideOptions,
  InlineOptions,
  Length,
  Middleware,
  MiddlewareArguments,
  MiddlewareData,
  MiddlewareReturn,
  MiddlewareState,
  NodeScroll,
  OffsetOptions,
  Padding,
  Placement,
  Platform,
  Rect,
  ReferenceElement,
  RootBoundary,
  ShiftOptions,
  Side,
  SideObject,
  SizeOptions,
  Strategy,
  VirtualElement,
} from '@floating-ui/dom';
export {
  arrow,
  autoPlacement,
  autoUpdate,
  computePosition,
  detectOverflow,
  flip,
  getOverflowAncestors,
  hide,
  inline,
  limitShift,
  offset,
  platform,
  shift,
  size,
} from '@floating-ui/dom';

type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type Delay = number | Partial<{ open: number; close: number }>;

export type NarrowedElement<T> = T extends Element ? T : Element;

/**
 * Options accepted by the position engine (`useFloating`'s positioning layer).
 * Solid equivalent of `UseFloatingOptions` from `@floating-ui/react-dom`; the
 * options object should be reactive (use getters for reactive values).
 */
export interface UsePositionOptions {
  /**
   * Where to place the floating element relative to the reference element.
   * @default 'bottom'
   */
  placement?: Placement | undefined;
  /**
   * The strategy to use when positioning the floating element.
   * @default 'absolute'
   */
  strategy?: Strategy | undefined;
  /**
   * Array of middleware objects to modify the positioning or provide data for
   * rendering.
   */
  middleware?: Array<Middleware | null | undefined | false> | undefined;
  /**
   * Custom or extended platform object.
   */
  platform?: Platform | undefined;
  /**
   * Object of external elements as an alternative to the `refs` object setters.
   */
  elements?:
    | {
        reference?: ReferenceType | null | undefined;
        floating?: HTMLElement | null | undefined;
      }
    | undefined;
  /**
   * Whether to use `transform` for positioning instead of `top` and `left`
   * (layout) in the `floatingStyles` object.
   * @default true
   */
  transform?: boolean | undefined;
  /**
   * Callback to handle mounting/unmounting of the elements.
   * @default undefined
   */
  whileElementsMounted?:
    | ((reference: ReferenceType, floating: HTMLElement, update: () => void) => () => void)
    | undefined;
  /**
   * Externally passed reference element. Store in state.
   */
  open?: boolean | undefined;
}

export interface UsePositionRefs {
  reference: RefObject<ReferenceType>;
  floating: RefObject<HTMLElement>;
  setReference(node: ReferenceType | null): void;
  setFloating(node: HTMLElement | null): void;
}

export interface UsePositionElements {
  reference: Accessor<ReferenceType | null>;
  floating: Accessor<HTMLElement | null>;
}

/**
 * Return value of the position engine. Solid equivalent of
 * `UseFloatingReturn` from `@floating-ui/react-dom`; reactive values are
 * accessors.
 */
export interface UsePositionFloatingReturn {
  x: Accessor<number>;
  y: Accessor<number>;
  placement: Accessor<Placement>;
  strategy: Accessor<Strategy>;
  middlewareData: Accessor<MiddlewareData>;
  /**
   * Whether the floating element has been positioned yet when used inside an
   * effect (not during render).
   */
  isPositioned: Accessor<boolean>;
  /**
   * Update the position of the floating element manually.
   */
  update: () => void;
  /**
   * Pre-computed positioning styles to apply to the floating element.
   */
  floatingStyles: Accessor<JSX.CSSProperties>;
  refs: UsePositionRefs;
  elements: UsePositionElements;
}

export interface ExtendedRefs {
  reference: RefObject<ReferenceType>;
  floating: RefObject<HTMLElement>;
  domReference: RefObject<NarrowedElement<ReferenceType>>;
  setReference(node: ReferenceType | null): void;
  setFloating(node: HTMLElement | null): void;
  setPositionReference(node: ReferenceType | null): void;
}

export interface ExtendedElements {
  reference: Accessor<ReferenceType | null>;
  floating: Accessor<HTMLElement | null>;
  domReference: Accessor<NarrowedElement<ReferenceType> | null>;
}

export interface FloatingEvents {
  emit<T extends string>(event: T, data?: any): void;
  on(event: string, handler: (data: any) => void): void;
  off(event: string, handler: (data: any) => void): void;
}

export interface ContextData {
  openEvent?: Event | undefined;
  floatingContext?: FloatingContext | undefined;
  [key: string]: any;
}

export type FloatingRootContext = FloatingRootStore;

export type FloatingContext = Omit<UsePositionFloatingReturn, 'refs' | 'elements'> & {
  open: Accessor<boolean>;
  onOpenChange(open: boolean, eventDetails: BaseUIChangeEventDetails<string>): void;
  events: FloatingEvents;
  dataRef: { current: ContextData };
  nodeId: Accessor<string | undefined>;
  floatingId: Accessor<string | undefined>;
  refs: ExtendedRefs;
  elements: ExtendedElements;
  rootStore: FloatingRootContext;
};

export interface FloatingNodeType {
  id: string | undefined;
  parentId: string | null;
  context?: FloatingContext | undefined;
}

export type FloatingTreeType = FloatingTreeStore;

export interface ElementProps {
  reference?: HTMLProps | undefined;
  floating?: HTMLProps | undefined;
  item?: HTMLProps | undefined;
  trigger?: HTMLProps | undefined;
}

export type ReferenceType = Element | VirtualElement;

export type UseFloatingData = Prettify<UseFloatingReturn>;

export type UseFloatingReturn = Prettify<
  UsePositionFloatingReturn & {
    /**
     * `FloatingContext`
     */
    context: Prettify<FloatingContext>;
    /**
     * Object containing the reference and floating refs and reactive setters.
     */
    refs: ExtendedRefs;
    elements: ExtendedElements;
  }
>;

export interface UseFloatingOptions extends Omit<UsePositionOptions, 'elements'> {
  rootContext?: FloatingRootContext | undefined;
  /**
   * Object of external elements as an alternative to the `refs` object setters.
   */
  elements?:
    | {
        /**
         * Externally passed reference element. Store in state.
         */
        reference?: ReferenceType | null | undefined;
        /**
         * Externally passed floating element. Store in state.
         */
        floating?: HTMLElement | null | undefined;
      }
    | undefined;
  /**
   * An event callback that is invoked when the floating element is opened or
   * closed.
   */
  onOpenChange?(open: boolean, eventDetails: BaseUIChangeEventDetails<string>): void;
  /**
   * Unique node id when using `FloatingTree`.
   */
  nodeId?: string | undefined;
  /**
   * External FloatingTree to use when the one provided by context can't be used.
   */
  externalTree?: FloatingTreeStore | undefined;
}
