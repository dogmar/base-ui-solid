import { createMemo, onCleanup, untrack, type Accessor } from 'solid-js';
import { Dynamic, type JSX } from '@solidjs/web';
import { spread } from '@solidjs/web';
import { mergeObjects } from '@base-ui/utils/mergeObjects';
import { warn } from '@base-ui/utils/warn';
import { EMPTY_OBJECT } from '@base-ui/utils/empty';
import type { BaseUIComponentProps, ComponentRenderFn, HTMLProps } from './types';
import { getStateAttributesProps, type StateAttributesMapping } from './getStateAttributesProps';
import { resolveClassName } from '../utils/resolveClassName';
import { resolveStyle } from '../utils/resolveStyle';
import { mergeProps, mergePropsN, mergeSolidClasses, mergeStyles } from '../merge-props';
import { applyRef, type Ref, type RefInput } from '../solid-utils/refs';

type IntrinsicTagName = keyof JSX.IntrinsicElements;

/**
 * Renders a Base UI element. Solid port of the React `useRenderElement`.
 *
 * Unlike the React version, this runs once per component instance and returns
 * reactive JSX. Prop objects passed via `params.props` should use getters for
 * reactive values so that the merged output tracks them.
 *
 * @param element The default HTML element to render. Can be overridden by the `render` prop.
 * @param componentProps The component's own props; `render`, `className`, `class` and `style` are used here.
 * @param params Additional parameters for rendering the element.
 */
export function useRenderElement<
  State extends Record<string, any>,
  RenderedElementType extends Element,
  TagName extends IntrinsicTagName | undefined,
>(
  element: TagName,
  componentProps: UseRenderElementComponentProps<State>,
  params: UseRenderElementParameters<State, RenderedElementType, TagName> = {},
): JSX.Element {
  const state = (params.state ?? (EMPTY_OBJECT as State)) as State;
  const enabled = () => {
    const enabledParam = params.enabled;
    if (typeof enabledParam === 'function') {
      return enabledParam();
    }
    return enabledParam !== false;
  };

  // The fully merged spreadable props, minus refs. Recomputed whenever any
  // reactive dependency (state, component props, prop-object getters) changes.
  const outProps: Accessor<Record<string, any>> = createMemo(() => {
    if (!enabled()) {
      return EMPTY_OBJECT as Record<string, any>;
    }

    const stateProps = getStateAttributesProps(state, params.stateAttributesMapping);
    const resolvedProps = params.props ? resolveRenderFunctionProps(params.props) : undefined;

    // Ensure the result is always a new mutable object, never EMPTY_OBJECT.
    const merged: Record<string, any> = mergeObjects(stateProps, resolvedProps) ?? {};

    if (element === 'button' && merged.type === undefined) {
      merged.type = 'button';
    }
    if (element === 'img' && merged.alt === undefined) {
      merged.alt = '';
    }

    const className = resolveClassName(componentProps.className, state);
    if (className !== undefined) {
      merged.class = mergeSolidClasses(merged.class, className);
    }
    if (componentProps.class !== undefined) {
      merged.class = mergeSolidClasses(merged.class, componentProps.class);
    }

    const style = resolveStyle(componentProps.style, state);
    if (style !== undefined) {
      merged.style = mergeStyles(merged.style, style);
    }

    return merged;
  });

  const composedRef = (el: RenderedElementType | null) => {
    // The ref present in the merged props (from internal prop objects).
    const innerRef = untrack(() => outProps().ref) as Ref<RenderedElementType> | undefined;
    applyRef(innerRef, el);
    applyRef(params.ref, el);
    applyRef(componentProps.ref, el);
  };

  onCleanup(() => {
    composedRef(null);
  });

  // A stable reactive view over the merged props, with the composed ref.
  // Property reads track the memo; spreading it in JSX stays reactive.
  const propsProxy = createPropsProxy(outProps, composedRef);

  // Spread source for JSX: a call expression keeps the compiled spread reactive.
  const spreadableProps = createMemo(() => {
    const merged: Record<string, any> = { ...outProps() };
    merged.ref = composedRef;
    return merged;
  });

  return (
    <>
      {(() => {
        if (!enabled()) {
          return null;
        }

        const renderProp = componentProps.render;

        if (renderProp) {
          return evaluateRenderProp(renderProp, propsProxy, state, composedRef);
        }

        if (typeof element === 'string') {
          return <Dynamic component={element as IntrinsicTagName} {...spreadableProps()} />;
        }

        // Unreachable, but the typings on `useRenderElement` need to be reworked
        // to annotate it correctly.
        throw new Error('Base UI: Render element or function are not defined.');
      }) as unknown as JSX.Element}
    </>
  );
}

function resolveRenderFunctionProps(
  props: NonNullable<UseRenderElementParameters<any, any, any>['props']>,
): HTMLProps {
  if (Array.isArray(props)) {
    return mergePropsN(props);
  }

  return mergeProps(undefined, props);
}

function createPropsProxy(
  outProps: Accessor<Record<string, any>>,
  composedRef: (el: any) => void,
): Record<string, any> {
  return new Proxy(
    {},
    {
      get(_target, key) {
        if (key === 'ref') {
          return composedRef;
        }
        return outProps()[key as string];
      },
      has(_target, key) {
        if (key === 'ref') {
          return true;
        }
        return key in outProps();
      },
      ownKeys() {
        const keys = Reflect.ownKeys(outProps()).filter((key) => key !== 'ref');
        keys.push('ref');
        return keys;
      },
      getOwnPropertyDescriptor(_target, key) {
        if (key === 'ref') {
          return { configurable: true, enumerable: true, value: composedRef };
        }
        const descriptor = Reflect.getOwnPropertyDescriptor(outProps(), key);
        if (descriptor) {
          descriptor.configurable = true;
        }
        return descriptor;
      },
    },
  );
}

function evaluateRenderProp<State>(
  render: NonNullable<UseRenderElementComponentProps<State>['render']>,
  propsProxy: Record<string, any>,
  state: State,
  composedRef: (el: any) => void,
): JSX.Element {
  if (typeof render === 'function') {
    if (process.env.NODE_ENV !== 'production') {
      warnIfRenderPropLooksLikeComponent(render as { name: string });
    }
    return (render as ComponentRenderFn<any, State>)(propsProxy, state);
  }

  if (render instanceof Element) {
    // A plain DOM element created by JSX: spread the merged props onto it,
    // preserving any class it already carries.
    const initialClass = render.getAttribute('class') ?? undefined;
    const elementProxy = new Proxy(propsProxy, {
      get(target, key) {
        const value = Reflect.get(target, key);
        if (key === 'class') {
          return mergeSolidClasses(initialClass, value);
        }
        return value;
      },
    });
    spread(render, elementProxy, true);
    composedRef(render);
    return render as unknown as JSX.Element;
  }

  if (process.env.NODE_ENV !== 'production') {
    // TODO: fix mui/no-guarded-throw
    // eslint-disable-next-line mui/no-guarded-throw
    throw new Error(
      [
        'Base UI: The `render` prop was provided an invalid value.',
        'Provide a function that takes props and state and returns the element to render,',
        'or a plain DOM element created with JSX.',
        'https://base-ui.com/r/invalid-render-prop',
      ].join('\n'),
    );
  }

  return render as JSX.Element;
}

const COMPONENT_IDENTIFIER_PATTERN = /^[A-Z][A-Za-z0-9$]*$/;
const LOWERCASE_CHARACTER_PATTERN = /[a-z]/;

function warnIfRenderPropLooksLikeComponent(renderFn: { name: string }) {
  const functionName = renderFn.name;
  if (functionName.length === 0) {
    return;
  }

  if (!COMPONENT_IDENTIFIER_PATTERN.test(functionName)) {
    return;
  }

  if (!LOWERCASE_CHARACTER_PATTERN.test(functionName)) {
    return;
  }

  warn(
    `The \`render\` prop received a function named \`${functionName}\` that starts with an uppercase letter.`,
    'This usually means a component was passed directly as `render={Component}`.',
    'Base UI calls `render` as a plain function once, with the props to spread as the first argument.',
    'If this is an intentional render callback, rename it to start with a lowercase letter.',
    'Use `render={(props) => <Component {...props} />}` instead.',
    'https://base-ui.com/r/invalid-render-prop',
  );
}

type RenderFunctionProps<TagName> = TagName extends keyof JSX.IntrinsicElements
  ? JSX.IntrinsicElements[TagName] & Record<string, any>
  : HTMLProps;

export type UseRenderElementParameters<
  State,
  RenderedElementType extends Element,
  TagName,
> = {
  /**
   * If `false` (or an accessor returning `false`), rendering is skipped and
   * `null` is produced. Reactive: pass an accessor to toggle at runtime.
   * @default true
   */
  enabled?: boolean | Accessor<boolean> | undefined;
  /**
   * The ref(s) to apply to the rendered element.
   */
  ref?: RefInput<RenderedElementType> | undefined;
  /**
   * The state of the component. Use getters for reactive values.
   */
  state?: State | undefined;
  /**
   * Intrinsic props to be spread on the rendered element.
   * Use getters inside these objects for reactive values.
   */
  props?:
    | RenderFunctionProps<TagName>
    | Array<
        | RenderFunctionProps<TagName>
        | undefined
        | ((props: RenderFunctionProps<TagName>) => RenderFunctionProps<TagName>)
      >
    | undefined;
  /**
   * A mapping of state to `data-*` attributes.
   */
  stateAttributesMapping?: StateAttributesMapping<State> | undefined;
};

export interface UseRenderElementComponentProps<State> {
  /**
   * The class name to apply to the rendered element.
   * Can be a string or a function that accepts the state and returns a string.
   */
  className?: string | ((state: State) => string | undefined) | undefined;
  /**
   * Solid-native class value merged after `className`.
   */
  class?: JSX.ClassValue | undefined;
  /**
   * The render prop (function or DOM element) to override the default element.
   */
  render?: undefined | JSX.Element | ComponentRenderFn<HTMLProps, State>;
  /**
   * The style to apply to the rendered element.
   * Can be a style object/string or a function that accepts the state and returns one.
   */
  style?:
    | JSX.CSSProperties
    | string
    | ((state: State) => JSX.CSSProperties | string | undefined)
    | undefined;
  /**
   * A ref to the rendered element.
   */
  ref?: RefInput<any> | undefined;
}

export type { BaseUIComponentProps };
