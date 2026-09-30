import type { Accessor } from 'solid-js';
import { useCompositeRootContext } from '../root/CompositeRootContext';
import {
  useCompositeListItem,
  type UseCompositeListItemParameters,
} from '../list/useCompositeListItem';
import type { HTMLProps } from '../../types';
import { createRef, useMergedRefs, type RefCallback } from '../../../solid-utils/refs';

export interface UseCompositeItemParameters<Metadata> extends Pick<
  UseCompositeListItemParameters<Metadata>,
  'metadata'
> {}

export function useCompositeItem<Metadata>(params: UseCompositeItemParameters<Metadata> = {}) {
  const { highlightItemOnHover, highlightedIndex, onHighlightedIndexChange } =
    useCompositeRootContext();
  const { ref, index } = useCompositeListItem(params);

  const isHighlighted: Accessor<boolean> = () => highlightedIndex() === index();

  const itemRef = createRef<HTMLElement>();
  const mergedRef = useMergedRefs<HTMLElement>(ref, itemRef);

  const compositeProps: HTMLProps = {
    get tabindex() {
      return isHighlighted() ? 0 : -1;
    },
    onFocus() {
      onHighlightedIndexChange(index());
    },
    onMouseMove() {
      const item = itemRef.current;
      if (!highlightItemOnHover() || !item) {
        return;
      }

      const disabled = item.hasAttribute('disabled') || item.ariaDisabled === 'true';
      if (!isHighlighted() && !disabled) {
        item.focus();
      }
    },
  };

  return {
    compositeProps,
    compositeRef: mergedRef as RefCallback<HTMLElement>,
    index,
  };
}
