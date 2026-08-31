import { createRenderEffect, createSignal, untrack, type Accessor } from 'solid-js';
import { isElementDisabled } from '@base-ui/utils/isElementDisabled';
import { EMPTY_ARRAY } from '@base-ui/utils/empty';
import type { TextDirection } from '../../direction-context/DirectionContext';
import {
  COMPOSITE_KEYS,
  ARROW_DOWN,
  ARROW_LEFT,
  ARROW_RIGHT,
  ARROW_UP,
  END,
  HOME,
  MODIFIER_KEYS,
  findNonDisabledListIndex,
  getMaxListIndex,
  getMinListIndex,
  isListIndexDisabled,
  isIndexOutOfListBounds,
  isNativeInput,
  scrollIntoViewIfNeeded,
  type ModifierKey,
} from '../composite';
import { ACTIVE_COMPOSITE_ITEM } from '../constants';
import type { CompositeMetadata } from '../list/CompositeList';
import type { HTMLProps } from '../../types';
import { getTarget } from '../../../floating-ui-react/utils';
import { applyRef, createRef, type Ref, type RefCallback } from '../../../solid-utils/refs';
import type { CompositeGridNavigator } from './gridNavigation';

export interface UseCompositeRootParameters {
  orientation?: 'horizontal' | 'vertical' | 'both' | undefined;
  grid?: CompositeGridNavigator | undefined;
  loopFocus?: boolean | undefined;
  onLoop?:
    | ((
        event: KeyboardEvent,
        prevIndex: number,
        nextIndex: number,
        elementsRef: { current: Array<HTMLElement | null> },
      ) => number)
    | undefined;
  highlightedIndex?: number | undefined;
  onHighlightedIndexChange?: ((index: number) => void) | undefined;
  direction: TextDirection;
  rootRef?: Ref<HTMLElement> | undefined;
  /**
   * When `true`, pressing the Home key moves focus to the first item,
   * and pressing the End key moves focus to the last item.
   * @default false
   */
  enableHomeAndEndKeys?: boolean | undefined;
  /**
   * When `true`, keypress events on Composite's navigation keys
   * be stopped with event.stopPropagation().
   * @default false
   */
  stopEventPropagation?: boolean | undefined;
  /**
   * Array of item indices to be considered disabled.
   * Used for composite items that are focusable when disabled.
   */
  disabledIndices?: number[] | undefined;
  /**
   * Array of [modifier key values](https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values#modifier_keys) that should allow normal keyboard actions
   * when pressed. By default, all modifier keys prevent normal actions.
   * @default []
   */
  modifierKeys?: ModifierKey[] | undefined;
}

/**
 * Solid port of the React `useCompositeRoot`. `params` fields are read lazily,
 * so pass an object with getters for reactive values. The returned
 * `highlightedIndex` is an accessor.
 */
export function useCompositeRoot(params: UseCompositeRootParameters) {
  const loopFocus = () => params.loopFocus ?? true;
  const orientation = () => params.orientation ?? 'both';
  const enableHomeAndEndKeys = () => params.enableHomeAndEndKeys ?? false;
  const modifierKeys = () => params.modifierKeys ?? (EMPTY_ARRAY as ModifierKey[]);

  const [internalHighlightedIndex, internalSetHighlightedIndex] = createSignal(0, {
    ownedWrite: true,
  });

  const rootRef = createRef<HTMLElement>();
  // Reads `params.rootRef` lazily so the hook body performs no reactive reads.
  const mergedRef: RefCallback<HTMLElement> = (value) => {
    applyRef(rootRef, value);
    applyRef(
      untrack(() => params.rootRef),
      value,
    );
  };

  const elementsRef: { current: Array<HTMLElement | null> } = { current: [] };
  let hasSetDefaultIndex = false;
  let highlightedElement: HTMLElement | null = null;

  const highlightedIndex: Accessor<number> = () =>
    params.highlightedIndex ?? internalHighlightedIndex();

  const onHighlightedIndexChange = (index: number, shouldScrollIntoView = false) => {
    highlightedElement = elementsRef.current[index] ?? null;
    (params.onHighlightedIndexChange ?? internalSetHighlightedIndex)(index);
    if (shouldScrollIntoView) {
      const newActiveItem = elementsRef.current[index] ?? null;
      scrollIntoViewIfNeeded(rootRef.current, newActiveItem, params.direction, orientation());
    }
  };

  const onMapChange = (map: Map<Element, CompositeMetadata<any>>) => {
    if (map.size === 0) {
      return;
    }

    const disabledIndices = params.disabledIndices;

    if (hasSetDefaultIndex) {
      const elements = elementsRef.current;
      // Items added or removed around the highlighted one shift its index, so the tab stop would
      // otherwise move to a different item and navigation would resume from the wrong position.
      const nextIndex = elements.indexOf(highlightedElement);

      if (nextIndex === -1) {
        // A replacement at the same index can keep the tab stop. Otherwise move it to an
        // eligible item so a missing, hidden, or disabled replacement does not take the
        // composite out of the tab order.
        const replacement = elements[highlightedIndex()];
        if (!replacement || isListIndexDisabled(elements, highlightedIndex(), disabledIndices)) {
          onHighlightedIndexChange(getFallbackIndex(elements, disabledIndices));
        } else {
          highlightedElement = replacement;
        }
      } else if (nextIndex !== highlightedIndex()) {
        onHighlightedIndexChange(nextIndex);
      }
      return;
    }

    hasSetDefaultIndex = true;

    const sortedElements = Array.from(map.keys()) as Array<HTMLElement | null>;
    const activeItem =
      sortedElements.find((compositeElement) =>
        compositeElement?.hasAttribute(ACTIVE_COMPOSITE_ITEM),
      ) ?? null;
    // Set the default highlighted index of an arbitrary composite item. The map value carries
    // the item's own index, which is not its position among the keys once a list mixes explicit
    // and automatic indexes and leaves gaps.
    const activeIndex = activeItem ? (map.get(activeItem)?.index ?? -1) : -1;

    if (activeIndex !== -1) {
      onHighlightedIndexChange(activeIndex);
    } else if (isListIndexDisabled(sortedElements, highlightedIndex(), disabledIndices)) {
      // The default highlighted item is disabled, so it should not hold the single
      // roving tab stop: a natively disabled element is removed from the tab order,
      // and an aria-disabled one should not be the entry point. Move the tab stop
      // to the first enabled item. If every item is disabled, keep the current
      // highlighted index.
      const firstEnabledIndex = findNonDisabledListIndex(sortedElements, { disabledIndices });
      if (!isIndexOutOfListBounds(sortedElements, firstEnabledIndex)) {
        onHighlightedIndexChange(firstEnabledIndex);
      }
    }

    scrollIntoViewIfNeeded(rootRef.current, activeItem, params.direction, orientation());
  };

  createRenderEffect(
    () => ({
      disabledIndices: params.disabledIndices,
      externalHighlightedIndex: params.highlightedIndex,
      highlightedIndex: highlightedIndex(),
    }),
    (current) => {
      // `disabledIndices` can resolve after the initial map population
      // (e.g. Toolbar derives it from item metadata through a state update), so the
      // default tab stop at index 0 may now point at a disabled item, leaving the
      // composite without a reachable tab stop. Re-validate and move it to the first
      // enabled item. Gated on `disabledIndices` being provided so composites that
      // rely on the DOM disabled fallback keep their existing behavior.
      if (
        current.disabledIndices == null ||
        current.externalHighlightedIndex != null ||
        !hasSetDefaultIndex
      ) {
        return;
      }
      const elements = elementsRef.current;
      if (isListIndexDisabled(elements, current.highlightedIndex, current.disabledIndices)) {
        const firstEnabledIndex = findNonDisabledListIndex(elements, {
          disabledIndices: current.disabledIndices,
        });
        if (!isIndexOutOfListBounds(elements, firstEnabledIndex)) {
          onHighlightedIndexChange(firstEnabledIndex);
        }
      }
    },
  );

  const wrappedOnLoop = (event: KeyboardEvent, prevIndex: number, nextIndex: number) => {
    const onLoop = params.onLoop;
    if (!onLoop) {
      return nextIndex;
    }
    return onLoop(event, prevIndex, nextIndex, elementsRef);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const isHomeOrEnd = event.key === HOME || event.key === END;
    if (!COMPOSITE_KEYS.has(event.key) || (!enableHomeAndEndKeys() && isHomeOrEnd)) {
      return;
    }

    if (isModifierKeySet(event, modifierKeys())) {
      return;
    }

    const element = rootRef.current;
    if (!element) {
      return;
    }

    const isRtl = params.direction === 'rtl';
    const currentOrientation = orientation();
    const disabledIndices = params.disabledIndices;
    const grid = params.grid;
    const isGrid = grid != null;

    const horizontalForwardKey = isRtl ? ARROW_LEFT : ARROW_RIGHT;
    const horizontalBackwardKey = isRtl ? ARROW_RIGHT : ARROW_LEFT;
    const forwardKey = currentOrientation === 'vertical' ? ARROW_DOWN : horizontalForwardKey;
    const backwardKey = currentOrientation === 'vertical' ? ARROW_UP : horizontalBackwardKey;

    const target = getTarget(event);
    if (target != null && isNativeInput(target) && !isElementDisabled(target)) {
      const selectionStart = target.selectionStart;
      const selectionEnd = target.selectionEnd;
      const textContent = target.value;
      // return to native textbox behavior when
      // 1 - Shift is held to make a text selection, or if there already is a text selection
      if (selectionStart == null || event.shiftKey || selectionStart !== selectionEnd) {
        return;
      }
      // 2 - arrow-ing forward and not in the last position of the text
      if (event.key !== backwardKey && selectionStart < textContent.length) {
        return;
      }
      // 3 -arrow-ing backward and not in the first position of the text
      if (event.key !== forwardKey && selectionStart > 0) {
        return;
      }
    }

    let nextIndex = highlightedIndex();
    const minIndex = getMinListIndex(elementsRef, disabledIndices);
    const maxIndex = getMaxListIndex(elementsRef, disabledIndices);

    if (grid != null) {
      nextIndex = grid({
        disabledIndices,
        elementsRef,
        event,
        highlightedIndex: highlightedIndex(),
        loopFocus: loopFocus(),
        maxIndex,
        minIndex,
        onLoop: wrappedOnLoop,
        orientation: currentOrientation,
        rtl: isRtl,
      });
    }

    const isForwardKey =
      (currentOrientation !== 'vertical' && event.key === horizontalForwardKey) ||
      (currentOrientation !== 'horizontal' && event.key === ARROW_DOWN);
    const isBackwardKey =
      (currentOrientation !== 'vertical' && event.key === horizontalBackwardKey) ||
      (currentOrientation !== 'horizontal' && event.key === ARROW_UP);

    if (enableHomeAndEndKeys()) {
      if (event.key === HOME) {
        nextIndex = minIndex;
      } else if (event.key === END) {
        nextIndex = maxIndex;
      }
    }

    if (nextIndex === highlightedIndex() && (isForwardKey || isBackwardKey)) {
      const onLoop = params.onLoop;
      if (loopFocus() && nextIndex === maxIndex && isForwardKey) {
        nextIndex = minIndex;
        if (onLoop) {
          nextIndex = onLoop(event, highlightedIndex(), nextIndex, elementsRef);
        }
      } else if (loopFocus() && nextIndex === minIndex && isBackwardKey) {
        nextIndex = maxIndex;
        if (onLoop) {
          nextIndex = onLoop(event, highlightedIndex(), nextIndex, elementsRef);
        }
      } else {
        nextIndex = findNonDisabledListIndex(elementsRef.current, {
          startingIndex: nextIndex,
          decrement: isBackwardKey,
          disabledIndices,
        });
      }
    }

    if (
      nextIndex !== highlightedIndex() &&
      !isIndexOutOfListBounds(elementsRef.current, nextIndex)
    ) {
      if (params.stopEventPropagation) {
        event.stopPropagation();
      }

      if (isGrid || isHomeOrEnd || isForwardKey || isBackwardKey) {
        event.preventDefault();
      }
      onHighlightedIndexChange(nextIndex, true);

      // Wait for FocusManager `returnFocus` to execute.
      queueMicrotask(() => {
        elementsRef.current[nextIndex]?.focus();
      });
    }
  };

  const props: HTMLProps = {
    ref: mergedRef,
    onFocus(event: FocusEvent) {
      const element = rootRef.current;
      const target = getTarget(event);
      if (!element || target == null || !isNativeInput(target)) {
        return;
      }
      target.setSelectionRange(0, target.value.length);
    },
    onKeyDown,
  };

  return {
    props,
    highlightedIndex,
    onHighlightedIndexChange,
    elementsRef,
    onMapChange,
    relayKeyboardEvent: onKeyDown,
  };
}

// Resolves the item that should hold the tab stop: the active item when it can take focus,
// otherwise the first item that can. Falls back to index 0 so an all-disabled composite keeps the
// index in range and regains a tab stop as soon as one of its items becomes focusable.
function getFallbackIndex(elements: Array<HTMLElement | null>, disabledIndices?: number[]) {
  let fallbackIndex = -1;

  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index];

    if (!element || isListIndexDisabled(elements, index, disabledIndices)) {
      continue;
    }

    if (element.hasAttribute(ACTIVE_COMPOSITE_ITEM)) {
      return index;
    }

    if (fallbackIndex === -1) {
      fallbackIndex = index;
    }
  }

  return Math.max(fallbackIndex, 0);
}

function isModifierKeySet(event: KeyboardEvent, ignoredModifierKeys: ModifierKey[]) {
  for (const key of MODIFIER_KEYS) {
    if (ignoredModifierKeys.includes(key)) {
      continue;
    }
    if (event.getModifierState(key)) {
      return true;
    }
  }
  return false;
}
