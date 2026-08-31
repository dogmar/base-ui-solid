import { createContext, useContext, type Context } from 'solid-js';

// Solid 2.0 treats `createContext(undefined)` as default-less, which throws on
// read outside a provider. Base UI has many optional contexts where reading
// `undefined` outside a provider is the expected behavior, so a sentinel
// default is used to emulate it.
const NO_VALUE = Symbol('base-ui-no-context-value');

/**
 * Creates a context that reads as `undefined` outside a provider instead of
 * throwing. Read it with {@link useOptionalContext}.
 */
export function createOptionalContext<T>(options?: { name?: string }): Context<T | undefined> {
  return createContext<T | undefined>(NO_VALUE as unknown as undefined, options as any);
}

/**
 * Reads an optional context created with {@link createOptionalContext},
 * returning `undefined` when no provider is present.
 */
export function useOptionalContext<T>(context: Context<T | undefined>): T | undefined {
  const value = useContext(context);
  return (value as unknown) === NO_VALUE ? undefined : value;
}
