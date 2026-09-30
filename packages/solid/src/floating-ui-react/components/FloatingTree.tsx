import { onCleanup, createUniqueId, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';
import type { FloatingNodeType, FloatingTreeType } from '../types';
import { FloatingTreeStore } from './FloatingTreeStore';

const FloatingNodeContext = createOptionalContext<FloatingNodeType>();
const FloatingTreeContext = createOptionalContext<FloatingTreeType>();

/**
 * Returns the parent node id for nested floating elements, if available.
 * Returns `null` for top-level floating elements.
 */
export const useFloatingParentNodeId = (): string | null =>
  useOptionalContext(FloatingNodeContext)?.id || null;

/**
 * Returns the nearest floating tree context, if available.
 */
export const useFloatingTree = (externalTree?: FloatingTreeStore): FloatingTreeType | null => {
  const contextTree = useOptionalContext(FloatingTreeContext) ?? null;
  return externalTree ?? contextTree;
};

/**
 * Registers a node into the `FloatingTree`, returning its id.
 * @see https://floating-ui.com/docs/FloatingTree
 */
export function useFloatingNodeId(externalTree?: FloatingTreeStore): string | undefined {
  const id = createUniqueId();
  const tree = useFloatingTree(externalTree);
  const parentId = useFloatingParentNodeId();

  if (tree) {
    const node: FloatingNodeType = { id, parentId };
    tree.addNode(node);
    onCleanup(() => {
      tree.removeNode(node);
    });
  }

  return id;
}

export interface FloatingNodeProps {
  children?: JSX.Element;
  id: string | undefined;
}

/**
 * Provides parent node context for nested floating elements.
 * @see https://floating-ui.com/docs/FloatingTree
 * @internal
 */
export function FloatingNode(props: FloatingNodeProps): JSX.Element {
  const parentId = useFloatingParentNodeId();

  const contextValue: FloatingNodeType = {
    get id() {
      return props.id;
    },
    parentId,
  };

  return <FloatingNodeContext value={contextValue}>{props.children}</FloatingNodeContext>;
}

export interface FloatingTreeProps {
  children?: JSX.Element;
  externalTree?: FloatingTreeStore | undefined;
}

/**
 * Provides context for nested floating elements when they are not children of
 * each other on the DOM.
 * This is not necessary in all cases, except when there must be explicit communication between parent and child floating elements. It is necessary for:
 * - The `bubbles` option in the `useDismiss()` Hook
 * - Nested virtual list navigation
 * - Nested floating elements that each open on hover
 * - Custom communication between parent and child floating elements
 * @see https://floating-ui.com/docs/FloatingTree
 * @internal
 */
export function FloatingTree(props: FloatingTreeProps): JSX.Element {
  const tree = untrack(() => props.externalTree) ?? new FloatingTreeStore();
  return <FloatingTreeContext value={tree}>{props.children}</FloatingTreeContext>;
}
