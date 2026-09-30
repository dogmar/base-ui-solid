import type { JSX } from '@solidjs/web';

/**
 * Runtime style properties captured/restored on DOM elements. Keys are
 * `CSSStyleDeclaration` (camelCase) property names, not Solid JSX style keys.
 */
export type PositionerInlineStyles = Partial<
  Record<
    | 'top'
    | 'left'
    | 'right'
    | 'bottom'
    | 'height'
    | 'minHeight'
    | 'maxHeight'
    | 'marginTop'
    | 'marginBottom',
    string
  >
>;

export function clearStyles(element: HTMLElement | null, originalStyles: PositionerInlineStyles) {
  if (element) {
    Object.assign(element.style, originalStyles);
  }
}

export const LIST_FUNCTIONAL_STYLES: JSX.CSSProperties = {
  position: 'relative',
  'max-height': '100%',
  'overflow-x': 'hidden',
  'overflow-y': 'auto',
};
