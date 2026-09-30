import { expect, test } from 'vitest';
import { createSignal, flush, Show } from 'solid-js';
import { render } from '@solidjs/testing-library';
import type { FloatingTreeType } from '../types';
import {
  FloatingNode,
  FloatingTree,
  useFloatingNodeId,
  useFloatingParentNodeId,
  useFloatingTree,
} from './FloatingTree';
import { FloatingTreeStore } from './FloatingTreeStore';

test('useFloatingParentNodeId returns null outside of a FloatingNode', () => {
  let parentId: string | null = 'unset' as string | null;

  function App() {
    parentId = useFloatingParentNodeId();
    return null;
  }

  render(() => <App />);
  expect(parentId).toBe(null);
});

test('useFloatingTree returns null outside of a FloatingTree', () => {
  let tree: FloatingTreeType | null = 'unset' as unknown as FloatingTreeType | null;

  function App() {
    tree = useFloatingTree();
    return null;
  }

  render(() => <App />);
  expect(tree).toBe(null);
});

test('useFloatingTree prefers an external tree', () => {
  const externalTree = new FloatingTreeStore();
  let tree: FloatingTreeType | null = null;

  function App() {
    tree = useFloatingTree(externalTree);
    return null;
  }

  render(() => (
    <FloatingTree>
      <App />
    </FloatingTree>
  ));
  expect(tree).toBe(externalTree);
});

test('registers nodes with their parent ids and unregisters them on cleanup', () => {
  const [showChild, setShowChild] = createSignal(true);
  let tree: FloatingTreeType | null = null;
  let rootNodeId: string | undefined;
  let childNodeId: string | undefined;
  let childParentId: string | null = null;

  function ChildNode() {
    childNodeId = useFloatingNodeId();
    childParentId = useFloatingParentNodeId();
    return null;
  }

  function RootNode() {
    tree = useFloatingTree();
    rootNodeId = useFloatingNodeId();
    return (
      <FloatingNode id={rootNodeId}>
        <Show when={showChild()}>
          <ChildNode />
        </Show>
      </FloatingNode>
    );
  }

  render(() => (
    <FloatingTree>
      <RootNode />
    </FloatingTree>
  ));
  flush();

  expect(rootNodeId).toBeDefined();
  expect(childNodeId).toBeDefined();
  expect(childParentId).toBe(rootNodeId);

  expect(tree!.nodesRef.current).toEqual([
    { id: rootNodeId, parentId: null },
    { id: childNodeId, parentId: rootNodeId },
  ]);

  setShowChild(false);
  flush();

  expect(tree!.nodesRef.current).toEqual([{ id: rootNodeId, parentId: null }]);
});

test('registers nodes into an external tree', () => {
  const externalTree = new FloatingTreeStore();
  let nodeId: string | undefined;

  function App() {
    nodeId = useFloatingNodeId(externalTree);
    return null;
  }

  const { unmount } = render(() => <App />);
  flush();

  expect(externalTree.nodesRef.current).toEqual([{ id: nodeId, parentId: null }]);

  unmount();
  flush();

  expect(externalTree.nodesRef.current).toEqual([]);
});

test('events emitter delivers tree-wide events', () => {
  const tree = new FloatingTreeStore();
  const received: any[] = [];
  const handler = (data: any) => received.push(data);

  tree.events.on('message', handler);
  tree.events.emit('message', { hello: true });
  expect(received).toEqual([{ hello: true }]);

  tree.events.off('message', handler);
  tree.events.emit('message', { hello: false });
  expect(received).toEqual([{ hello: true }]);
});
