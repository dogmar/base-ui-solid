import { createMemo, getOwner, runWithOwner, untrack, type Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';

function resolveDeep(value: unknown): unknown {
  let resolved = value;
  while (typeof resolved === 'function' && !resolved.length) {
    resolved = (resolved as () => unknown)();
  }
  if (Array.isArray(resolved)) {
    return resolved.map(resolveDeep);
  }
  return resolved;
}

/**
 * Returns a stable accessor over `children` for use inside the reactive merged
 * props of `useRenderElement`.
 *
 * The merged-props memo re-evaluates whenever any element prop changes (state
 * data-attributes included). Reading `props.children` directly there would
 * re-create the entire child subtree on every such change. This helper:
 *
 * - evaluates the raw children exactly once (lazily, on first read, under the
 *   owner where the helper was created so context providers resolve properly);
 * - wraps each top-level child in its own memo, so a reactive child (e.g. a
 *   conditionally rendered Base UI part) only re-creates itself, leaving its
 *   siblings' DOM nodes untouched.
 */
export function createStableChildren(getChildren: () => JSX.Element): Accessor<JSX.Element> {
  const owner = getOwner();
  let itemAccessors: Array<() => unknown> | null = null;

  return () => {
    if (itemAccessors === null) {
      itemAccessors = runWithOwner(owner, () =>
        untrack(() => {
          const raw = getChildren();
          const items = Array.isArray(raw) ? raw : [raw];
          return items.map((item) =>
            typeof item === 'function' ? createMemo(() => resolveDeep(item)) : () => item,
          );
        }),
      ) as Array<() => unknown>;
    }
    return itemAccessors.map((read) => read()) as unknown as JSX.Element;
  };
}
