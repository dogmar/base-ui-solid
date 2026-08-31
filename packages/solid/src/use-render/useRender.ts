import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { ComponentRenderFn, HTMLProps } from '../internals/types';
import { useRenderElement } from '../internals/useRenderElement';
import type { StateAttributesMapping } from '../internals/getStateAttributesProps';
import type { RefInput } from '../solid-utils/refs';

/**
 * Renders a Base UI element.
 *
 * @public
 */
export function useRender<State extends Record<string, unknown>, RenderedElementType extends Element>(
  params: useRender.Parameters<State, RenderedElementType>,
): useRender.ReturnValue {
  return useRenderElement(params.defaultTagName ?? 'div', params, params);
}

export type UseRenderRenderProp<State = Record<string, unknown>> =
  JSX.Element | ComponentRenderFn<HTMLProps, State>;

export type UseRenderElementProps<ElementType extends keyof JSX.IntrinsicElements> =
  JSX.IntrinsicElements[ElementType];

export type UseRenderComponentProps<
  ElementType extends keyof JSX.IntrinsicElements,
  State = {},
  RenderFunctionProps = HTMLProps,
> = JSX.IntrinsicElements[ElementType] & {
  /**
   * Allows you to replace the component's HTML element
   * with a different tag, or compose it with another component.
   *
   * Accepts a function that returns the element to render, or a DOM element.
   */
  render?: JSX.Element | ComponentRenderFn<RenderFunctionProps, State> | undefined;
};

export interface UseRenderParameters<State, RenderedElementType extends Element> {
  /**
   * The element or a function that returns one to override the default element.
   */
  render?: UseRenderRenderProp<State> | undefined;
  /**
   * The ref to apply to the rendered element.
   */
  ref?: RefInput<RenderedElementType> | undefined;
  /**
   * The state of the component, passed as the second argument to the `render` callback.
   * State properties are automatically converted to data-* attributes.
   * Use getters for reactive values.
   */
  state?: State | undefined;
  /**
   * Custom mapping for converting state properties to data-* attributes.
   * @example
   * { isActive: (value) => (value ? { 'data-is-active': '' } : null) }
   */
  stateAttributesMapping?: StateAttributesMapping<State> | undefined;
  /**
   * Props to be spread on the rendered element.
   * They are merged with the internal props of the component, so that event handlers
   * are merged, `class` values and `style` properties are joined, while other external props overwrite the
   * internal ones. Use getters for reactive values.
   */
  props?: Record<string, unknown> | undefined;
  /**
   * If `false` (or an accessor returning `false`), rendering is skipped and
   * `null` is produced.
   * @default true
   */
  enabled?: boolean | Accessor<boolean> | undefined;
  /**
   * The default tag name to use for the rendered element when `render` is not provided.
   * @default 'div'
   */
  defaultTagName?: keyof JSX.IntrinsicElements | undefined;
}

export type UseRenderReturnValue = JSX.Element;

export interface UseRenderState {}

export namespace useRender {
  export type State = UseRenderState;
  export type RenderProp<TState = Record<string, unknown>> = UseRenderRenderProp<TState>;

  export type ElementProps<ElementType extends keyof JSX.IntrinsicElements> =
    UseRenderElementProps<ElementType>;

  export type ComponentProps<
    ElementType extends keyof JSX.IntrinsicElements,
    TState = {},
    RenderFunctionProps = HTMLProps,
  > = UseRenderComponentProps<ElementType, TState, RenderFunctionProps>;

  export type Parameters<
    TState,
    RenderedElementType extends Element,
  > = UseRenderParameters<TState, RenderedElementType>;

  export type ReturnValue = UseRenderReturnValue;
}
