import { createMemo, createRenderEffect, createSignal, type Accessor } from 'solid-js';
import type { PopupHandleStoreProvider } from './popupHandle';

/**
 * Reads the store currently exposed by a popup handle and subscribes to store-pointer changes.
 * Detached triggers use this to follow a handle as a root attaches or detaches: while no root is
 * attached, the handle exposes its fallback store; once a root attaches, subscribers are notified
 * and read from the live root store.
 *
 * Returns an accessor resolving to `undefined` when no handle is provided so callers can fall back
 * to their root context.
 *
 * Solid port note: the React version returns the store directly (via
 * `useSyncExternalStore`); here an accessor is returned, and the consuming trigger re-creates its
 * store-bound scope when the accessor's value changes.
 *
 * @param handle Accessor for the popup handle to read from, or `undefined` when the trigger is not
 * handle-bound.
 */
export function usePopupHandleStore<HandleStore>(
  handle: Accessor<PopupHandleStoreProvider<HandleStore> | undefined>,
): Accessor<HandleStore | undefined> {
  const [version, setVersion] = createSignal(0, { ownedWrite: true });

  createRenderEffect(handle, (currentHandle) => {
    if (currentHandle === undefined) {
      return undefined;
    }
    return currentHandle.subscribeStore(() => {
      setVersion((value) => value + 1);
    });
  });

  return createMemo(() => {
    version();
    return handle()?.store;
  });
}
