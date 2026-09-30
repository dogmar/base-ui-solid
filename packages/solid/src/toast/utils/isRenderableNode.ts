/**
 * Whether a resolved children value renders visible content.
 *
 * Solid note: this operates on *resolved* children values (strings, numbers,
 * DOM nodes, arrays). Functions (lazy children thunks) are treated as
 * renderable without being invoked, since evaluating them here would create
 * elements outside their insertion point.
 */
export function isRenderableNode(node: unknown): boolean {
  if (node == null || typeof node === 'boolean' || node === '') {
    return false;
  }
  if (Array.isArray(node)) {
    return node.some(isRenderableNode);
  }
  return true;
}

/**
 * Whether a resolved element carries renderable content.
 *
 * Solid note: unlike the React version (which introspects a virtual element's
 * `props.children`), this inspects a real DOM element's child nodes.
 */
export function hasRenderableChildren(element: unknown): boolean {
  return element instanceof Element && isRenderableNode(Array.from(element.childNodes));
}
