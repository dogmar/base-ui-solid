import {
  children as resolveChildren,
  createMemo,
  createRenderEffect,
  untrack,
  Show,
  type Accessor,
  type Setter,
} from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { useToastRootContext } from '../root/ToastRootContext';
import { isRenderableNode } from './isRenderableNode';

/**
 * Shared logic for `Toast.Title` and `Toast.Description`, which only differ by the rendered tag,
 * the fallback content, and which id setter they register with. Resolves the content and returns
 * the pieces each part passes to `useRenderElement` and `useToastLabelElement`.
 *
 * Solid note: React introspects the produced element's `props.children` to decide whether the
 * part renders. Solid has no element introspection, so the render prop's own children are
 * snapshotted from the DOM element (or detected from the render function's resolved output in
 * `useToastLabelElement`), and empty content falls back to that snapshot.
 */
export function useToastLabelPart(
  componentProps: {
    id?: unknown;
    children?: JSX.Element;
    render?: unknown;
  },
  part: 'title' | 'description',
) {
  const ctx = useToastRootContext();

  const setId = part === 'title' ? ctx.setTitleId : ctx.setDescriptionId;

  const renderProp = untrack(() => componentProps.render);
  // Snapshot the render element's own children before `useRenderElement`
  // replaces them, so a childless content fallback can restore them.
  const renderOwnChildren: Node[] =
    renderProp instanceof Element ? Array.from(renderProp.childNodes) : [];

  const content = () =>
    componentProps.children ?? (part === 'title' ? ctx.toast.title : ctx.toast.description);

  // A stable thunk handed to `useRenderElement`'s children entry; the engine
  // wraps it in a memo so content updates only re-create the label's children.
  const children = (() => {
    const value = content();
    if (isRenderableNode(value)) {
      return value;
    }
    return renderOwnChildren.length > 0 ? (renderOwnChildren as unknown as JSX.Element) : value;
  }) as unknown as JSX.Element;

  const id = useBaseUiId(() => componentProps.id as string | undefined);

  return {
    id,
    children,
    type: () => ctx.toast.type,
    setId,
    content,
    renderOwnChildren,
    renderIsFunction: typeof renderProp === 'function',
  };
}

/**
 * Mounts the evaluated label element only when it carries renderable content (so a `render` prop's
 * own children count, while a childless styling-only `render` stays conditional), registering the
 * generated id with the root while the part renders.
 */
export function useToastLabelElement(
  element: JSX.Element,
  id: Accessor<string | undefined>,
  setId: Setter<string | undefined>,
  options: {
    content: Accessor<unknown>;
    renderOwnChildren: Node[];
    renderIsFunction: boolean;
  },
): JSX.Element {
  const resolved = resolveChildren(() => element);

  const shouldRender = createMemo(() => {
    if (isRenderableNode(options.content())) {
      return true;
    }
    if (options.renderOwnChildren.length > 0) {
      return true;
    }
    if (options.renderIsFunction) {
      // A render function may produce an element carrying its own children;
      // resolve the output and inspect the DOM (mirroring React's
      // `hasRenderableChildren` check on the produced element).
      const nodes = resolved.toArray();
      return nodes.some((node) =>
        node instanceof Element ? node.childNodes.length > 0 : isRenderableNode(node),
      );
    }
    return false;
  });

  createRenderEffect(
    () => ({ shouldRender: shouldRender(), id: id() }),
    (current) => {
      if (!current.shouldRender) {
        return undefined;
      }

      setId(current.id as any);
      return () => {
        setId((currentId) => (currentId === current.id ? undefined : currentId));
      };
    },
  );

  return <Show when={shouldRender()}>{resolved()}</Show>;
}
