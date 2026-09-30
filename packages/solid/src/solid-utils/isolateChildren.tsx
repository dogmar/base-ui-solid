import { createMemo, createRenderEffect, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';

function resolveDeep(value: unknown): unknown {
  let resolved = value;
  while (typeof resolved === 'function' && !(resolved as () => unknown).length) {
    resolved = (resolved as () => unknown)();
  }
  if (Array.isArray(resolved)) {
    return resolved.map(resolveDeep);
  }
  return resolved;
}

function wrapItem(item: unknown): () => unknown {
  if (typeof item === 'function' && !(item as () => unknown).length) {
    const value = createMemo(() => resolveDeep(item));
    // A permanent observer of the isolating memo so it (and the lazy
    // `children()`/flatten memos it reads) is never auto-disposed for being
    // unobserved, which would re-create the resolved subtree on the next read.
    createRenderEffect(value, () => {});
    return value;
  }
  if (Array.isArray(item)) {
    const nested = item.map(wrapItem);
    return () => nested.map((read) => read());
  }
  return () => item;
}

/**
 * Isolates each child (recursively through arrays) in its own memo, so a
 * reactive child only re-creates itself.
 *
 * Solid resolves the children of an insertion point (a fragment, a context
 * provider without an element, `children()`) inside a single tracked
 * computation that re-invokes **every** function child whenever any child's
 * resolved value changes. `useRenderElement` produces non-memoized render
 * thunks that build a fresh DOM element on every call, so without isolation a
 * sibling toggling (a popup opening) re-creates unrelated elements — and when
 * those elements register themselves in reactive state from refs (popup
 * triggers, positioners), the re-creation feeds back into the resolution scope
 * and loops.
 *
 * `useRenderElement` applies the same isolation to its own element children
 * via `createStableChildren`; this component covers the two remaining spots:
 * providers that render no element of their own, and the render thunk a
 * component returns into arbitrary user-controlled surroundings.
 *
 * The children structure is evaluated once (untracked); reactivity inside each
 * child is preserved through its per-child memo.
 */
export function IsolateChildren(props: { children: JSX.Element }): JSX.Element {
  const items = untrack(() => {
    const raw = props.children as unknown;
    const list = Array.isArray(raw) ? raw : [raw];
    return list.map(wrapItem);
  });
  return (() => items.map((read) => read())) as unknown as JSX.Element;
}
