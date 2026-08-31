/* eslint-disable no-bitwise */
import { createEffect, createSignal, onCleanup } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { CompositeListContext, type CompositeListRegistration } from './CompositeListContext';

export type CompositeMetadata<CustomMetadata> = {
  index: number;
} & CustomMetadata;

interface CompositeListItem<Metadata> {
  index: number;
  element: HTMLElement;
  registration: CompositeListRegistration<Metadata>;
}

/**
 * Provides context for a list of items in a composite component.
 *
 * Solid port notes: components run once, so the registration map lives in plain
 * (non-reactive) module state and a signal tick schedules index recomputation.
 * Items register through the context during ref attachment; a render effect
 * flushes the registry (sorting by DOM position, publishing the map) before
 * paint, mirroring the React layout-effect behavior.
 */
export function CompositeList<Metadata>(props: CompositeList.Props<Metadata>): JSX.Element {
  const listeners = new Set<(map: Map<Element, CompositeMetadata<Metadata>>) => void>();
  const map = new Map<Element, CompositeListRegistration<Metadata>>();
  const nextIndexRef = { current: 0 };

  let isDirty = true;
  let items: readonly CompositeListItem<Metadata>[] | null = null;
  let mutationObserver: MutationObserver | null = null;

  const [mapTick, setMapTick] = createSignal(0, { ownedWrite: true });

  // Item registrations can arrive without the list re-rendering. Schedule one
  // flush for the whole batch so refs are rebuilt before paint.
  const scheduleMapUpdate = () => {
    if (isDirty) {
      return;
    }

    isDirty = true;
    setMapTick((tick) => tick + 1);
  };

  const register = (node: Element, registration: CompositeListRegistration<Metadata>) => {
    map.set(node, registration);
    scheduleMapUpdate();
  };

  const unregister = (node: Element) => {
    map.delete(node);
    scheduleMapUpdate();
  };

  const syncRefs = (currentItems: readonly CompositeListItem<Metadata>[]) => {
    const nextMap = new Map<Element, CompositeMetadata<Metadata>>();
    const { elementsRef, labelsRef } = props;

    elementsRef.current.length = 0;
    if (labelsRef) {
      labelsRef.current.length = 0;
    }

    currentItems.forEach((item) => {
      nextMap.set(item.element, {
        ...(item.registration.metadata ?? ({} as Metadata)),
        index: item.index,
      });

      elementsRef.current[item.index] = item.element;

      if (labelsRef) {
        labelsRef.current[item.index] =
          item.registration.label !== undefined
            ? item.registration.label
            : (item.registration.textRef?.current?.textContent ?? item.element.textContent);
      }
    });

    nextIndexRef.current = elementsRef.current.length;

    return nextMap;
  };

  function observe(sortedNodes: HTMLElement[]) {
    mutationObserver?.disconnect();
    mutationObserver = null;

    // A single item can't reorder.
    if (typeof MutationObserver !== 'function' || sortedNodes.length < 2) {
      return;
    }

    const observer = new MutationObserver((entries) => {
      // Only verify the order after a move: a node that was removed and later
      // re-added within the same batch. Additions and removals alone can't
      // change the relative order of the remaining items, and items that mount
      // or unmount re-sort through `register`/`unregister`.
      if (!hasMovedNode(entries)) {
        return;
      }

      let previousConnectedNode: Element | null = null;

      // If any connected node now appears before the previous connected node,
      // wrappers/items moved and the index map needs to be rebuilt.
      for (const node of sortedNodes) {
        if (!node.isConnected) {
          continue;
        }

        if (previousConnectedNode && sortByDocumentPosition(previousConnectedNode, node) > 0) {
          observer.disconnect();
          scheduleMapUpdate();
          return;
        }

        previousConnectedNode = node;
      }
    });

    mutationObserver = observer;

    // A reorder that changes item indexes must invert at least one adjacent pair
    // from the previous sorted order. Observing each pair's common parent catches
    // both direct item moves and ancestor wrapper moves at the boundary.
    const roots = new Set<Element>();
    for (let i = 1; i < sortedNodes.length; i += 1) {
      const root = getCommonAncestor(sortedNodes[i - 1], sortedNodes[i]);
      if (root) {
        roots.add(root);
      }
    }

    roots.forEach((root) => observer.observe(root, { childList: true }));
  }

  const flushList = () => {
    const [nextItems, automaticNodes] = getCompositeListSnapshot(map);
    const nextMap = syncRefs(nextItems);

    const previousItems = items;
    const changed =
      !previousItems ||
      previousItems.length !== nextItems.length ||
      nextItems.some((item, index) => {
        const previousItem = previousItems[index];
        return (
          item.index !== previousItem.index ||
          item.element !== previousItem.element ||
          item.registration.index !== previousItem.registration.index ||
          item.registration.metadata !== previousItem.registration.metadata
        );
      });

    observe(automaticNodes);
    items = nextItems;
    isDirty = false;

    if (!changed) {
      return;
    }

    listeners.forEach((listener) => listener(nextMap));
    props.onMapChange?.(nextMap);
  };

  // A user effect (not a render effect) so newly created item elements are
  // attached to the document before the registry is flushed — the flush skips
  // disconnected nodes, mirroring the React layout-effect commit timing.
  createEffect(
    () => mapTick(),
    () => {
      if (isDirty) {
        flushList();
      }
    },
  );

  onCleanup(() => {
    mutationObserver?.disconnect();
    mutationObserver = null;
    props.elementsRef.current.length = 0;
    if (props.labelsRef) {
      props.labelsRef.current.length = 0;
    }
  });

  const subscribeMapChange = (fn: (map: Map<Element, CompositeMetadata<Metadata>>) => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  };

  const contextValue = { register, unregister, subscribeMapChange, nextIndexRef };

  return <CompositeListContext value={contextValue}>{props.children}</CompositeListContext>;
}

function getCompositeListSnapshot<Metadata>(
  map: Map<Element, CompositeListRegistration<Metadata>>,
) {
  const reservedIndices = new Set<number>();
  const items: CompositeListItem<Metadata>[] = [];
  const automaticItems: CompositeListItem<Metadata>[] = [];

  map.forEach((registration, node) => {
    if (!node.isConnected) {
      return;
    }

    const index = registration.index;
    const item = {
      index: index ?? -1,
      element: node as HTMLElement,
      registration,
    };

    if (index === null) {
      automaticItems.push(item);
    } else if (index >= 0) {
      reservedIndices.add(index);
      items.push(item);
    }
  });

  let nextAutomaticIndex = 0;
  automaticItems.sort((a, b) => sortByDocumentPosition(a.element, b.element));

  automaticItems.forEach((item) => {
    while (reservedIndices.has(nextAutomaticIndex)) {
      nextAutomaticIndex += 1;
    }

    item.index = nextAutomaticIndex;
    items.push(item);
    nextAutomaticIndex += 1;
  });

  if (reservedIndices.size > 0) {
    items.sort((a, b) => a.index - b.index);
  }

  return [items, automaticItems.map((item) => item.element)] as const;
}

function getCommonAncestor(firstNode: Element, lastNode: Element) {
  let ancestor = firstNode.parentElement;

  // The `parentElement` walk cannot cross shadow boundaries, so the native
  // `contains` is sufficient here.
  while (ancestor && !ancestor.contains(lastNode)) {
    ancestor = ancestor.parentElement;
  }

  return ancestor;
}

function hasMovedNode(entries: MutationRecord[]) {
  for (const entry of entries) {
    for (let i = 0; i < entry.removedNodes.length; i += 1) {
      if (entry.removedNodes[i].isConnected) {
        return true;
      }
    }
  }

  return false;
}

function sortByDocumentPosition(a: Element, b: Element) {
  // `DOCUMENT_POSITION_CONTAINED_BY` is always reported alongside `FOLLOWING`, and `CONTAINS`
  // alongside `PRECEDING`, so testing `FOLLOWING` alone orders siblings and nested items alike.
  return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

export interface CompositeListState {}

export interface CompositeListProps<Metadata> {
  children: JSX.Element;
  /**
   * A ref to the list of HTML elements, ordered by their index.
   * Explicit indexes can leave empty slots in the array.
   * `useListNavigation`'s `listRef` prop.
   */
  elementsRef: { current: Array<HTMLElement | null> };
  /**
   * A ref to the list of element labels, ordered by their index.
   * `useTypeahead`'s `listRef` prop.
   */
  labelsRef?: { current: Array<string | null> } | undefined;
  onMapChange?: ((newMap: Map<Element, CompositeMetadata<Metadata>>) => void) | undefined;
}

export namespace CompositeList {
  export type State = CompositeListState;
  export type Props<Metadata> = CompositeListProps<Metadata>;
}
