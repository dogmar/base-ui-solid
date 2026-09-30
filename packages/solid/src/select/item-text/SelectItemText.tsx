import { createRenderEffect, omit, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import { useSelectRootContext } from '../root/SelectRootContext';
import { useSelectItemContext } from '../item/SelectItemContext';
import { useRenderElement } from '../../internals/useRenderElement';

/**
 * A text label of the select item.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectItemText(componentProps: SelectItemText.Props): JSX.Element {
  const { index, textRef, selectedByFocus } = useSelectItemContext();
  const store = useSelectRootContext();

  const elementProps = omit(componentProps, 'render', 'className', 'class', 'style', 'ref');

  let node: HTMLElement | null = null;

  const applyTextRefs = (el: HTMLElement, currentIndex: number, isSelectedByFocus: boolean) => {
    if (currentIndex === 0) {
      store.context.firstItemTextRef.current = el;
    }
    if (isSelectedByFocus) {
      store.context.selectedItemTextRef.current = el;
    }
  };

  const localRef = (el: HTMLElement | null) => {
    node = el;
    if (el) {
      applyTextRefs(el, untrack(index), untrack(selectedByFocus));
    }
  };

  // The React version re-attaches the ref callback whenever `index`/`selectedByFocus`
  // change; Solid refs run once, so the writes are re-applied through a render effect.
  createRenderEffect(
    () => ({ index: index(), selectedByFocus: selectedByFocus() }),
    (current) => {
      if (!node) {
        return;
      }

      applyTextRefs(node, current.index, current.selectedByFocus);
    },
  );

  const element = useRenderElement('div', componentProps, {
    ref: [localRef, textRef],
    props: [elementProps],
  });

  return element;
}

export interface SelectItemTextState {}

export interface SelectItemTextProps extends BaseUIComponentProps<'div', SelectItemTextState> {}

export namespace SelectItemText {
  export type State = SelectItemTextState;
  export type Props = SelectItemTextProps;
}
