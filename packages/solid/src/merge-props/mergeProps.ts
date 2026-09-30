import type { JSX } from '@solidjs/web';
import type { BaseUIEvent, HTMLProps } from '../internals/types';

// Internal prop objects use `BaseUIEvent`-typed handlers, which are
// contravariant with the JSX handler unions, so inputs are typed loosely.
type AnyProps = Record<string, any>;
type InputProps = AnyProps | ((otherProps: HTMLProps) => HTMLProps) | undefined;

const EMPTY_PROPS = {};

/* eslint-disable id-denylist */
/**
 * Merges multiple sets of props. It follows the Object.assign pattern where the rightmost object's fields overwrite
 * the conflicting ones from others. This doesn't apply to event handlers, `class`/`className` and `style` props.
 *
 * Event handlers are merged and called in right-to-left order (rightmost handler executes first, leftmost last).
 * For DOM events, the rightmost handler can prevent prior (left-positioned) handlers from executing
 * by calling `event.preventBaseUIHandler()`. For non-DOM events (custom events with primitive/object values),
 * all handlers always execute without prevention capability.
 *
 * The `class` prop is merged using Solid's array class form in right-to-left order.
 * The `style` prop is merged with rightmost styles overwriting the prior ones
 * (a string style replaces any prior style entirely).
 *
 * Props can either be provided as objects or as functions that take the previous props as an argument.
 * The function will receive the merged props up to that point (going from left to right):
 * so in the case of `(obj1, obj2, fn, obj3)`, `fn` will receive the merged props of `obj1` and `obj2`.
 * The function is responsible for chaining event handlers if needed (that is, we don't run the merge logic).
 *
 * Event handlers returned by the functions are not automatically prevented when `preventBaseUIHandler` is called.
 * They must check `event.baseUIHandlerPrevented` themselves and bail out if it's true.
 *
 * @important **`ref` is not merged.**
 * @public
 */
export function mergeProps(
  a: InputProps,
  b: InputProps,
  c: InputProps,
  d: InputProps,
  e: InputProps,
): HTMLProps;
export function mergeProps(a: InputProps, b: InputProps, c: InputProps, d: InputProps): HTMLProps;
export function mergeProps(a: InputProps, b: InputProps, c: InputProps): HTMLProps;
export function mergeProps(a: InputProps, b: InputProps): HTMLProps;
export function mergeProps(a: any, b: any, c?: any, d?: any, e?: any) {
  if (!c && !d && !e && !a) {
    return createInitialMergedProps(b);
  }

  // We need to mutably own `merged`.
  let merged = createInitialMergedProps(a);

  if (b) {
    merged = mergeInto(merged, b);
  }
  if (c) {
    merged = mergeInto(merged, c);
  }
  if (d) {
    merged = mergeInto(merged, d);
  }
  if (e) {
    merged = mergeInto(merged, e);
  }

  return merged;
}
/* eslint-enable id-denylist */

/**
 * Merges an arbitrary number of props using the same logic as {@link mergeProps}.
 * This function accepts an array of props instead of individual arguments.
 * @public
 */
export function mergePropsN(props: InputProps[]): HTMLProps {
  if (props.length === 0) {
    return EMPTY_PROPS as HTMLProps;
  }
  if (props.length === 1) {
    return createInitialMergedProps(props[0]) as HTMLProps;
  }

  // We need to mutably own `merged`.
  let merged = createInitialMergedProps(props[0]);

  for (let i = 1; i < props.length; i += 1) {
    merged = mergeInto(merged, props[i]);
  }

  return merged as HTMLProps;
}

function createInitialMergedProps(inputProps: InputProps) {
  if (isPropsGetter(inputProps)) {
    // Getter-returned handlers intentionally keep their existing semantics.
    return { ...resolvePropsGetter(inputProps, EMPTY_PROPS) };
  }

  return copyInitialProps(inputProps);
}

function mergeInto(merged: Record<string, any>, inputProps: InputProps) {
  if (isPropsGetter(inputProps)) {
    return resolvePropsGetter(inputProps, merged as HTMLProps);
  }
  return mutablyMergeInto(merged, inputProps);
}

function copyInitialProps(inputProps: AnyProps | undefined) {
  const copiedProps = { ...inputProps } as Record<string, any>;

  if ('className' in copiedProps) {
    copiedProps.class = mergeSolidClasses(copiedProps.class, copiedProps.className);
    delete copiedProps.className;
  }

  // `copiedProps` is our fresh own-object copy, so iterating with `for...in` is safe here.
  // eslint-disable-next-line guard-for-in
  for (const propName in copiedProps) {
    const propValue = copiedProps[propName];
    if (isEventHandler(propName, propValue)) {
      copiedProps[propName] = wrapEventHandler(propValue);
    }
  }

  return copiedProps;
}

/**
 * Merges two sets of props. In case of conflicts, the external props take precedence.
 */
function mutablyMergeInto(mergedProps: Record<string, any>, externalProps: AnyProps | undefined) {
  if (!externalProps) {
    return mergedProps;
  }

  // eslint-disable-next-line guard-for-in
  for (const propName in externalProps) {
    const externalPropValue = (externalProps as Record<string, any>)[propName];

    switch (propName) {
      case 'style': {
        mergedProps.style = mergeStyles(
          mergedProps.style as JSX.CSSProperties | string | undefined,
          externalPropValue as JSX.CSSProperties | string | undefined,
        );
        break;
      }
      case 'class':
      case 'className': {
        mergedProps.class = mergeSolidClasses(
          mergedProps.class as JSX.ClassValue | undefined,
          externalPropValue as JSX.ClassValue | undefined,
        );
        break;
      }
      default: {
        if (isEventHandler(propName, externalPropValue)) {
          mergedProps[propName] = mergeEventHandlers(mergedProps[propName], externalPropValue);
        } else {
          mergedProps[propName] = externalPropValue;
        }
      }
    }
  }

  return mergedProps;
}

function isEventHandler(key: string, value: unknown) {
  // This approach is more efficient than using a regex.
  const code0 = key.charCodeAt(0);
  const code1 = key.charCodeAt(1);
  const code2 = key.charCodeAt(2);
  return (
    code0 === 111 /* o */ &&
    code1 === 110 /* n */ &&
    code2 >= 65 /* A */ &&
    code2 <= 90 /* Z */ &&
    (typeof value === 'function' || typeof value === 'undefined')
  );
}

function isPropsGetter(inputProps: InputProps): inputProps is (props: HTMLProps) => HTMLProps {
  return typeof inputProps === 'function';
}

function resolvePropsGetter(inputProps: InputProps, previousProps: HTMLProps) {
  if (isPropsGetter(inputProps)) {
    return inputProps(previousProps);
  }

  return inputProps ?? (EMPTY_PROPS as HTMLProps);
}

function mergeEventHandlers(ourHandler: Function | undefined, theirHandler: Function | undefined) {
  if (!theirHandler) {
    return ourHandler;
  }
  if (!ourHandler) {
    return wrapEventHandler(theirHandler);
  }

  return (...args: unknown[]) => {
    const event = args[0];

    if (isDOMEvent(event)) {
      const baseUIEvent = event as BaseUIEvent<Event>;

      makeEventPreventable(baseUIEvent);

      const result = theirHandler(...args);

      if (!baseUIEvent.baseUIHandlerPrevented) {
        ourHandler?.(...args);
      }

      return result;
    }

    const result = theirHandler(...args);
    ourHandler?.(...args);
    return result;
  };
}

function wrapEventHandler(handler: Function | undefined) {
  if (!handler) {
    return handler;
  }

  return (...args: unknown[]) => {
    const event = args[0];

    if (isDOMEvent(event)) {
      makeEventPreventable(event as BaseUIEvent<Event>);
    }

    return handler(...args);
  };
}

export function makeEventPreventable<T extends Event>(event: BaseUIEvent<T>) {
  event.preventBaseUIHandler = () => {
    (event.baseUIHandlerPrevented as boolean) = true;
  };

  return event;
}

/**
 * Merges two class values using Solid's array class form.
 * The second ("their") class appears first, matching the React implementation's
 * `theirClassName + ' ' + ourClassName` ordering.
 */
export function mergeSolidClasses(
  ourClass: JSX.ClassValue | undefined,
  theirClass: JSX.ClassValue | undefined,
): JSX.ClassValue | undefined {
  if (theirClass != null && theirClass !== false) {
    if (ourClass != null && ourClass !== false) {
      return [theirClass, ourClass];
    }

    return theirClass;
  }

  return ourClass;
}

/**
 * Backwards-compatible alias operating on plain string classes.
 */
export function mergeClassNames(
  ourClassName: string | undefined,
  theirClassName: string | undefined,
) {
  if (theirClassName) {
    if (ourClassName) {
      // eslint-disable-next-line prefer-template
      return theirClassName + ' ' + ourClassName;
    }

    return theirClassName;
  }

  return ourClassName;
}

/**
 * Merges two style values. Object styles are shallow-merged with `theirStyle`
 * taking precedence; a string style replaces any prior style entirely.
 */
export function mergeStyles(
  ourStyle: JSX.CSSProperties | string | undefined,
  theirStyle: JSX.CSSProperties | string | undefined,
): JSX.CSSProperties | string | undefined {
  if (theirStyle == null) {
    return ourStyle;
  }
  if (ourStyle == null || typeof theirStyle === 'string' || typeof ourStyle === 'string') {
    return theirStyle;
  }
  return { ...ourStyle, ...theirStyle };
}

function isDOMEvent(event: unknown): event is Event {
  return (
    event != null &&
    typeof event === 'object' &&
    'stopPropagation' in event &&
    'target' in event &&
    'type' in event
  );
}
