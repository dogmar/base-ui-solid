import type { StyleValue } from '../internals/types';

/**
 * If the provided style is an object or string, it will be returned as is.
 * Otherwise, the function will call the style function with the state as the first argument.
 */
export function resolveStyle<State>(
  style: StyleValue | ((state: State) => StyleValue | undefined) | undefined,
  state: State,
) {
  return typeof style === 'function' ? style(state) : style;
}
