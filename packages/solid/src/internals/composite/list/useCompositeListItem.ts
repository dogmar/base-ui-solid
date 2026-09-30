import { createEffect, createSignal, onCleanup, untrack, type Accessor } from 'solid-js';
import { useCompositeListContext } from './CompositeListContext';
import type { CompositeMetadata } from './CompositeList';
import type { RefObject } from '../../../solid-utils/refs';

export interface UseCompositeListItemParameters<Metadata> {
  /**
   * Whether to guess the initial index from render order, avoiding an index
   * correction after mount for flat lists.
   * @default false
   */
  guess?: boolean | undefined;
  index?: number | undefined;
  label?: string | null | undefined;
  /**
   * Metadata published with the item. Keep object values referentially stable to avoid
   * unnecessarily re-registering the item.
   */
  metadata?: Metadata | undefined;
  /** Keep the ref object stable to avoid unnecessarily re-registering the item. */
  textRef?: RefObject<HTMLElement> | undefined;
}

interface UseCompositeListItemReturnValue {
  ref: (node: HTMLElement | null) => void;
  index: Accessor<number>;
}

/**
 * Used to register a list item and its index (DOM position) in the `CompositeList`.
 *
 * Solid port notes: `params` fields are read lazily (pass getters for reactive
 * values) and the returned `index` is an accessor.
 */
export function useCompositeListItem<Metadata>(
  params: UseCompositeListItemParameters<Metadata> = {},
): UseCompositeListItemReturnValue {
  const { register, unregister, subscribeMapChange, nextIndexRef } = useCompositeListContext();

  // Guess the index from the render order. This avoids an index correction after
  // mount for flat lists rendered in DOM order; when the guess is wrong (grouped
  // or out-of-order rendering), the registry flush corrects it before paint.
  const initialIndex = untrack(() => {
    if (params.index == null && params.guess) {
      const newIndex = nextIndexRef.current;
      nextIndexRef.current += 1;
      return newIndex;
    }
    return -1;
  });

  const [internalIndex, setInternalIndex] = createSignal(initialIndex, { ownedWrite: true });
  const index: Accessor<number> = () => params.index ?? internalIndex();

  let componentNode: HTMLElement | null = null;

  const makeRegistration = () => ({
    metadata: params.metadata ?? null,
    index: params.index ?? null,
    label: params.label,
    textRef: params.textRef,
  });

  const ref = (node: HTMLElement | null) => {
    if (componentNode) {
      unregister(componentNode);
    }

    componentNode = node;

    if (node) {
      register(node, untrack(makeRegistration));
    }
  };

  // Registration data is reactive in Solid, so re-register the current node with
  // a fresh snapshot when it changes; the list republishes with the new values.
  createEffect(
    makeRegistration,
    (registration) => {
      if (componentNode) {
        register(componentNode, registration);
      }
    },
    { defer: true },
  );

  const unsubscribe = subscribeMapChange((map: Map<Element, CompositeMetadata<Metadata>>) => {
    if (untrack(() => params.index) != null) {
      return;
    }

    const i = componentNode ? map.get(componentNode)?.index : null;

    if (i != null) {
      setInternalIndex(i);
    }
  });

  onCleanup(() => {
    unsubscribe();
    if (componentNode) {
      unregister(componentNode);
      componentNode = null;
    }
  });

  return { ref, index };
}
