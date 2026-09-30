import { createUniqueId, type Accessor } from 'solid-js';

/**
 * Generates a `base-ui-`-prefixed id, allowing an override.
 * Solid port of `useBaseUiId`; returns an accessor.
 * @param idOverride overrides the generated id when it returns a defined value
 */
export function useBaseUiId(idOverride?: Accessor<string | undefined>): Accessor<string | undefined> {
  const generatedId = `base-ui-${createUniqueId()}`;
  return () => idOverride?.() ?? generatedId;
}
